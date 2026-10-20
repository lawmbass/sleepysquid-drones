/* eslint-disable @next/next/no-img-element */
// Costumed SleepySquid pilot: the squid swims (animated inside hero-squid.svg) while its
// quadcopter lifts off, loops around the hero and comes back to hover. Decorative only.
export default function DroneSquidHero() {
  return (
    <div className="dsq-stage" aria-hidden="true">
      <div className="dsq-fly">
        <div className="dsq-tilt">
          <img src="/brand/hero-drone.svg" alt="" className="dsq-drone" width="600" height="203" />
        </div>
      </div>
      <img src="/brand/hero-drone-waves.svg" alt="" className="dsq-waves" width="177" height="80" />
      <img src="/brand/hero-squid.svg" alt="" className="dsq-squid" width="560" height="1000" />
    </div>
  );
}
