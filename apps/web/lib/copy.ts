const QUESTIONS_BY_FIRM: Record<string, string[]> = {
  'firm-alpha': [
    'What notice period does the Harbor Services Agreement require?',
    'How long is the Amber warranty, and what is the sole remedy?',
    'What damages cap does the Quay limitation of liability set?',
  ],
  'firm-beta': [
    'What does the Zephyr Quill merger discussion say about the breakup fee?',
    'What did the board minutes decide about new office space?',
    'What does the compensation grid describe?',
  ],
};

export function questionsFor(slug: string | null | undefined): string[] {
  if (slug && QUESTIONS_BY_FIRM[slug]) return QUESTIONS_BY_FIRM[slug];
  return QUESTIONS_BY_FIRM['firm-alpha'];
}

export function roleBadgeClass(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'badge admin';
    case 'EDITOR':
      return 'badge editor';
    case 'READER':
      return 'badge reader';
    default:
      return 'badge';
  }
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'ADMIN':
      return 'Admin';
    case 'EDITOR':
      return 'Editor';
    case 'READER':
      return 'Reader';
    default:
      return role ?? 'Signed in';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'QUEUED':
      return 'Queued';
    case 'PROCESSING':
      return 'Rendering';
    case 'PENDING':
      return 'Starting';
    case 'STREAMING':
      return 'Writing';
    case 'COMPLETE':
      return 'Ready';
    case 'FAILED':
      return 'Failed';
    case 'PUBLISHED':
      return 'Published';
    case 'DRAFT':
      return 'Draft';
    case 'USER':
      return 'You';
    case 'ASSISTANT':
      return 'LexBridge';
    default:
      return status;
  }
}

export function auditLabel(action: string): string {
  const words = action.replaceAll('.', ' ').replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function previewBody(body: string): string {
  const withoutNotice = body.replace(/^Synthetic sample[^.]*\.\s*/i, '');
  if (withoutNotice.length <= 220) return withoutNotice;
  return `${withoutNotice.slice(0, 220).trim()}…`;
}
