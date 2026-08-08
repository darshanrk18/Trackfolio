import type { Metadata } from "next";
import { ResumeLab } from "./resume-lab";

export const metadata: Metadata = { title: "Resume Lab" };

export default function ResumePage() {
  return <ResumeLab />;
}
