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


if __name__ == "__main__":
    unittest.main()
