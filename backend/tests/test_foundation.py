import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from backend.app import database, main, schemas


class FakeRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}


class FoundationApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = database.DB_PATH
        database.DB_PATH = Path(self.temp_dir.name) / "ops_training_test.db"
        database.init_db()

    def tearDown(self):
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def _bearer_request(self, token):
        return FakeRequest({"Authorization": "Bearer {0}".format(token)})

    def test_init_db_seeds_foundation_bootstrap(self):
        payload = database.get_foundation_bootstrap()

        self.assertGreaterEqual(len(payload["terms"]), 1)
        self.assertGreaterEqual(len(payload["classes"]), 1)
        self.assertGreaterEqual(len(payload["courseBatches"]), 1)
        self.assertGreaterEqual(len(payload["groups"]), 14)

    def test_foundation_bootstrap_requires_actor(self):
        with self.assertRaises(HTTPException) as missing_actor_error:
            main.foundation_bootstrap(FakeRequest())
        self.assertEqual(missing_actor_error.exception.status_code, 401)

        payload = main.foundation_bootstrap(FakeRequest({"X-Actor-Username": "2301180107"}))
        self.assertIn("groups", payload)

    def test_p1_can_create_foundation_records_through_routes(self):
        request = FakeRequest({"X-Actor-Username": "103085"})

        term = main.create_term_entry(
            request,
            schemas.TermPayload(code="TERM-2026-S", name="2026 春"),
        )["term"]
        class_item = main.create_class_entry(
            request,
            schemas.ClassPayload(code="CLASS-2401", name="24 饮品 1 班"),
        )["classItem"]
        course_batch = main.create_course_batch_entry(
            request,
            schemas.CourseBatchPayload(
                name="2026 春第一批",
                courseName="门店创意饮品策划与运营实践",
                termId=term["id"],
                classIds=[class_item["id"]],
                startWeek=1,
                endWeek=18,
            ),
        )["courseBatch"]
        group = main.create_group_entry(
            request,
            schemas.GroupPayload(
                batchId=course_batch["id"],
                name="A 组",
                sequence=1,
            ),
        )["group"]
        group_member = main.create_group_member_entry(
            request,
            schemas.GroupMemberPayload(
                groupId=group["id"],
                studentUsername="2401270101",
            ),
        )["groupMember"]
        schedule_assignment = main.create_schedule_assignment_entry(
            request,
            schemas.ScheduleAssignmentPayload(
                batchId=course_batch["id"],
                teachingWeek="第 1 周",
                weekStartDate="2026-03-11",
                primaryGroupId=group["id"],
                notes="首周轮值",
            ),
        )["scheduleAssignment"]
        resource = main.create_resource_entry(
            request,
            schemas.ResourcePayload(
                title="门店规范",
                category="制度文件",
                description="课堂基础资料",
                externalUrl="https://example.com/resource",
            ),
        )["resource"]

        payload = database.get_foundation_bootstrap()

        self.assertEqual(term["code"], "TERM-2026-S")
        self.assertEqual(class_item["code"], "CLASS-2401")
        self.assertEqual(course_batch["classIds"], [class_item["id"]])
        self.assertEqual(group_member["studentUsername"], "2401270101")
        self.assertEqual(schedule_assignment["primaryGroupId"], group["id"])
        self.assertEqual(resource["createdBy"], "周欣")
        self.assertTrue(any(item["id"] == course_batch["id"] for item in payload["courseBatches"]))
        self.assertTrue(any(item["id"] == resource["id"] for item in payload["resources"]))

    def test_p2_can_record_certification_and_scores(self):
        foundation = database.get_foundation_bootstrap()
        batch = foundation["courseBatches"][0]
        group = next(item for item in foundation["groups"] if item["batchId"] == batch["id"])
        request = FakeRequest({"X-Actor-Username": "2301180107"})

        certification = main.create_certification_entry(
            request,
            schemas.CertificationPayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270101",
                roleName="冰吧岗位",
                plannedDate="2026-04-01",
                completedDate="2026-04-03",
                result="PASS",
                score="95",
                notes="独立完成标准出品",
            ),
        )["certification"]
        course_score = main.create_course_score_entry(
            request,
            schemas.CourseScorePayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270101",
                managerScore=88,
                teacherScore=92,
                notes="课程总评分",
            ),
        )["courseScore"]
        showcase_score = main.create_showcase_score_entry(
            request,
            schemas.ShowcaseScorePayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270101",
                judgeName="评委A",
                score=94,
                notes="展示赛表现稳定",
            ),
        )["showcaseScore"]

        refreshed = main.foundation_bootstrap(request)

        self.assertEqual(certification["result"], "PASS")
        self.assertEqual(certification["studentUsername"], "2401270101")
        self.assertAlmostEqual(course_score["finalScore"], 90.8)
        self.assertEqual(showcase_score["judgeName"], "评委A")
        self.assertTrue(any(item["id"] == certification["id"] for item in refreshed["certifications"]))
        self.assertTrue(any(item["id"] == course_score["id"] for item in refreshed["courseScores"]))
        self.assertTrue(any(item["id"] == showcase_score["id"] for item in refreshed["showcaseScores"]))

    def test_login_creates_session_and_logout_revokes_it(self):
        login_response = main.login(
            schemas.LoginRequest(username="2401270101", password="2401270101")
        )

        self.assertIn("token", login_response)
        self.assertIn("actor", login_response)
        self.assertNotIn("password", login_response["actor"])

        request = FakeRequest(
            {"Authorization": "Bearer {0}".format(login_response["token"])}
        )
        session_response = main.session_status(request)
        self.assertEqual(session_response["actor"]["username"], "2401270101")

        logout_response = main.logout(request)
        self.assertEqual(logout_response.status_code, 204)

        with self.assertRaises(HTTPException) as revoked_error:
            main.session_status(request)
        self.assertEqual(revoked_error.exception.status_code, 401)

    def test_scope_access_and_account_responses_are_server_enforced(self):
        database.save_week(
            "2401270102",
            "2026-03-11",
            {"startDate": "2026-03-11", "members": {"a": "刘静", "b": ""}},
        )

        student_login = main.login(
            schemas.LoginRequest(username="2401270101", password="2401270101")
        )
        student_request = self._bearer_request(student_login["token"])

        with self.assertRaises(HTTPException) as forbidden_error:
            main.fetch_week("2401270102", "2026-03-11", student_request)
        self.assertEqual(forbidden_error.exception.status_code, 403)

        paired_login = main.login(
            schemas.LoginRequest(
                username="2401270101",
                password="2401270101",
                secondUsername="2401270102",
                secondPassword="2401270102",
            )
        )
        paired_week = main.fetch_week(
            "2401270102",
            "2026-03-11",
            self._bearer_request(paired_login["token"]),
        )
        self.assertEqual(paired_week["week"]["members"]["a"], "刘静")

        manager_login = main.login(
            schemas.LoginRequest(username="2301180107", password="2301180107")
        )
        manager_week = main.fetch_week(
            "2401270102",
            "2026-03-11",
            self._bearer_request(manager_login["token"]),
        )
        self.assertEqual(manager_week["week"]["members"]["a"], "刘静")

        bootstrap_payload = main.bootstrap()
        self.assertNotIn("password", bootstrap_payload["users"][0])

        accounts_payload = main.accounts(
            self._bearer_request(
                main.login(schemas.LoginRequest(username="103085", password="103085"))["token"]
            )
        )
        self.assertNotIn("password", accounts_payload["users"][0])

        with self.assertRaises(HTTPException) as account_error:
            main.accounts(student_request)
        self.assertEqual(account_error.exception.status_code, 403)

    def test_week_workflow_transitions_write_audit_logs(self):
        database.save_week(
            "2401270101",
            "2026-03-11",
            {"startDate": "2026-03-11", "members": {"a": "周露", "b": ""}},
        )
        database.save_week(
            "2401270101",
            "2026-03-18",
            {"startDate": "2026-03-18", "members": {"a": "周露", "b": ""}},
        )

        student_request = self._bearer_request(
            main.login(schemas.LoginRequest(username="2401270101", password="2401270101"))["token"]
        )
        reviewer_request = self._bearer_request(
            main.login(schemas.LoginRequest(username="2301180107", password="2301180107"))["token"]
        )
        admin_request = self._bearer_request(
            main.login(schemas.LoginRequest(username="103085", password="103085"))["token"]
        )

        rejected = main.submit_workflow_action(
            student_request,
            schemas.WorkflowActionPayload(
                resourceType="week",
                scopeUser="2401270101",
                startDate="2026-03-11",
            ),
        )["workflow"]
        self.assertEqual(rejected["status"], "submitted")

        rejected = main.reject_workflow_action(
            reviewer_request,
            schemas.WorkflowActionPayload(
                resourceType="week",
                scopeUser="2401270101",
                startDate="2026-03-11",
                comment="缺少经理评语",
            ),
        )["workflow"]
        self.assertEqual(rejected["status"], "rejected")

        approved = main.submit_workflow_action(
            student_request,
            schemas.WorkflowActionPayload(
                resourceType="week",
                scopeUser="2401270101",
                startDate="2026-03-18",
            ),
        )["workflow"]
        self.assertEqual(approved["status"], "submitted")

        approved = main.approve_workflow_action(
            reviewer_request,
            schemas.WorkflowActionPayload(
                resourceType="week",
                scopeUser="2401270101",
                startDate="2026-03-18",
            ),
        )["workflow"]
        self.assertEqual(approved["status"], "approved")

        archived = main.archive_workflow_action(
            admin_request,
            schemas.WorkflowActionPayload(
                resourceType="week",
                scopeUser="2401270101",
                startDate="2026-03-18",
                comment="本周归档",
            ),
        )["workflow"]
        self.assertEqual(archived["status"], "archived")

        audit_logs = database.list_audit_logs()
        actions = [item["action"] for item in audit_logs]
        self.assertIn("submit", actions)
        self.assertIn("reject", actions)
        self.assertIn("approve", actions)
        self.assertIn("archive", actions)

    def test_foundation_bootstrap_is_scoped_for_p3(self):
        foundation = database.get_foundation_bootstrap()
        batch = foundation["courseBatches"][0]
        group = next(item for item in foundation["groups"] if item["batchId"] == batch["id"])
        reviewer_request = self._bearer_request(
            main.login(schemas.LoginRequest(username="2301180107", password="2301180107"))["token"]
        )

        main.create_certification_entry(
            reviewer_request,
            schemas.CertificationPayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270101",
                roleName="冰吧岗位",
                result="PASS",
            ),
        )
        main.create_course_score_entry(
            reviewer_request,
            schemas.CourseScorePayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270101",
                managerScore=88,
                teacherScore=92,
            ),
        )
        main.create_showcase_score_entry(
            reviewer_request,
            schemas.ShowcaseScorePayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270101",
                judgeName="评委A",
                score=95,
            ),
        )
        main.create_course_score_entry(
            reviewer_request,
            schemas.CourseScorePayload(
                batchId=batch["id"],
                groupId=group["id"],
                studentUsername="2401270102",
                managerScore=80,
                teacherScore=82,
            ),
        )

        student_request = self._bearer_request(
            main.login(schemas.LoginRequest(username="2401270101", password="2401270101"))["token"]
        )
        student_payload = main.foundation_bootstrap(student_request)

        self.assertTrue(student_payload["courseScores"])
        self.assertTrue(student_payload["certifications"])
        self.assertTrue(student_payload["showcaseScores"])
        self.assertTrue(all(item["studentUsername"] == "2401270101" for item in student_payload["courseScores"]))
        self.assertTrue(all(item["studentUsername"] == "2401270101" for item in student_payload["certifications"]))
        self.assertTrue(all(item["studentUsername"] == "2401270101" for item in student_payload["showcaseScores"]))

    def test_p2_cannot_write_student_week_payload(self):
        reviewer_request = self._bearer_request(
            main.login(schemas.LoginRequest(username="2301180107", password="2301180107"))["token"]
        )

        with self.assertRaises(HTTPException) as forbidden_error:
            main.upsert_week(
                "2401270101",
                "2026-03-11",
                schemas.WeekPayload(
                    week={"startDate": "2026-03-11", "members": {"a": "周露", "b": ""}}
                ),
                reviewer_request,
            )
        self.assertEqual(forbidden_error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
