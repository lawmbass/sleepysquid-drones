import { plainTag } from "@/libs/aiPortal/tags";
export default function Tag({ t }) { const p = plainTag(t); return <span className={`p-tag ${p.kind}`} title={p.tip} tabIndex={0} aria-label={`${p.label}: ${p.tip}`}>{p.label}</span>; }
