'use client'
import GridLayout from "react-grid-layout"
import { OPRModule, OPRSmallModule } from "@/components/modules/opr-module"
import 'react-grid-layout/css/styles.css'

export function ModularDashboard() {
  const layout = [
    { i: "a", x: 0, y: 0, w: 6, h: 8, isResizable: false },
    { i: "b", x: 0, y: 0, w: 6, h: 8, isResizable: false },
    { i: "c", x: 0, y: 0, w: 6, h: 8, isResizable: false },
    { i: "d", x: 0, y: 0, w: 3, h: 8, isResizable: false },
    { i: "e", x: 0, y: 0, w: 3, h: 8, isResizable: false },
    { i: "f", x: 0, y: 0, w: 3, h: 8, isResizable: false },
  ]

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={30}
      width={1800}
    >
      <div key="a">
        <OPRModule eventCode={"USUTCMP"} teamNumber={3747} />
      </div>
      <div key="b">
        <OPRModule eventCode={"USUTCMP"} teamNumber={3747} />
      </div>
      <div key="c">
        <OPRModule eventCode={"USUTCMP"} teamNumber={3747} />
      </div>
      <div key="d">
        <OPRSmallModule eventCode={"USUTCMP"} teamNumber={3747} />
      </div>
      <div key="e">
        <OPRSmallModule eventCode={"USUTCMP"} teamNumber={3747} />
      </div>
      <div key="f">
        <OPRSmallModule eventCode={"USUTCMP"} teamNumber={3747} />
      </div>
    </GridLayout >
  );
}
