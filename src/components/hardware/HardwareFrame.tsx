import type { ReactNode } from 'react';

type HardwareFrameProps = {
  leftPanel: ReactNode;
  centralScreen: ReactNode;
  controlKnobPanel: ReactNode;
  footSwitchPanel: ReactNode;
  rightUtilityPanel: ReactNode;
  expressionPedal: ReactNode;
  masterStatusBar: ReactNode;
};

function HardwareFrame({
  leftPanel,
  centralScreen,
  controlKnobPanel,
  footSwitchPanel,
  rightUtilityPanel,
  expressionPedal,
  masterStatusBar,
}: HardwareFrameProps) {
  return (
    <section className="hardware-frame" aria-label="Touchscreen guitar multi-effector">
      <div className="hardware-screw is-top-left" aria-hidden="true" />
      <div className="hardware-screw is-top-right" aria-hidden="true" />
      <div className="hardware-screw is-bottom-left" aria-hidden="true" />
      <div className="hardware-screw is-bottom-right" aria-hidden="true" />

      <div className="hardware-core">
        <div className="hardware-left-panel">{leftPanel}</div>
        <div className="hardware-screen-bay">{centralScreen}</div>
        <div className="hardware-knob-bay">{controlKnobPanel}</div>
        <div className="hardware-utility-panel">{rightUtilityPanel}</div>
        <div className="hardware-expression-bay">{expressionPedal}</div>
        <div className="hardware-foot-bay">{footSwitchPanel}</div>
        <div className="hardware-status-bay">{masterStatusBar}</div>
      </div>
    </section>
  );
}

export default HardwareFrame;
