import { assetUrl } from "../lib/assets";

export function PortalLanding({ onEnter }) {
  return (
    <main className="portal-shell">
      <section className="portal-brand-panel" aria-label="学院门户品牌区">
        <div className="portal-ribbon" aria-hidden="true" />
        <div className="portal-brand-card">
          <p className="portal-brand-kicker">HMS x Travelologist</p>
          <img
            className="portal-brand-logo"
            src={assetUrl("portal/portal-hms-logo.png")}
            alt="酒店管理学院标识"
          />
          <p className="portal-brand-copy">Hotel Management School · 饮品生产性实训基地</p>
        </div>
      </section>

      <section className="portal-media-panel" aria-label="实训系统入口">
        <img
          className="portal-media-poster"
          src={assetUrl("portal/portal-coffee-poster.jpg")}
          alt=""
          aria-hidden="true"
        />
        <video
          className="portal-media-video"
          src={assetUrl("portal/portal-coffee.mp4")}
          poster={assetUrl("portal/portal-coffee-poster.jpg")}
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="portal-media-overlay" />

        <div className="portal-entry-copy">
          <p className="portal-entry-kicker">Travelologist Coffee OPS System</p>
          <h1 className="portal-entry-title">
            饮品生产性实训基地
            <br />
            综合实训系统
          </h1>
          <p className="portal-entry-subtitle">Production-Oriented Beverage Training Base Integrated Operations Portal</p>
          <button className="portal-enter-button" type="button" onClick={onEnter}>
            点击进入
          </button>
        </div>

        <footer className="portal-footer-legal">
          <p>Copyright © 裴荣康 保留所有权利</p>
          <p>若在使用过程中遇到填报、系统故障等问题，欢迎及时联系反馈。</p>
        </footer>
      </section>
    </main>
  );
}
