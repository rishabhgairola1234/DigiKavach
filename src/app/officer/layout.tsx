import { OfficerSosListener } from "./officer-sos-listener";

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfficerSosListener />
      {children}
    </>
  );
}
