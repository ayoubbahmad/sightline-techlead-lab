import { createHash } from 'node:crypto';

export function computeFingerprint(
  projectId: string,
  tool: string,
  ruleId: string | null,
  file: string | null,
  message: string,
): string {
  // Normalize message: strip line/column numbers, memory addresses, timestamps
  const normalizedMessage = message
    .replace(/\b\d{1,6}\b/g, 'N')
    .replace(/0x[0-9a-fA-F]+/g, '0xADDR')
    .trim();

  const input = [projectId, tool, ruleId ?? '', file ?? '', normalizedMessage].join('\x00');
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
