import { SUBMIT_ENDPOINT } from './site';

/**
 * The browser side shared by the report forms (/submit and /submit/event).
 *
 * With an endpoint, the form posts to a Worker that opens the issue on the
 * sender's behalf, so no GitHub account is needed. Without one — or when the
 * Worker fails — it sends the person to the GitHub Issue Form with their
 * answers already filled in. Either way the site stays static.
 */
export interface SubmitFormOptions {
  /** The issue label, sent to the Worker so it knows which form it got. */
  kind: string;
  /**
   * Names of the required fields left empty, in the reader's language. The
   * Worker, or the Issue Form's required fields, check again: this only avoids
   * a pointless round trip.
   */
  missing: (data: FormData) => string[];
  /** Inputs to flag with `aria-invalid` when left empty. */
  requiredInputs: string[];
  /** What the Worker receives. */
  answers: (data: FormData) => Record<string, unknown>;
  /** The pre-filled Issue Form for the same answers. */
  issueUrl: (data: FormData) => string;
}

export const text = (data: FormData, name: string): string => String(data.get(name) ?? '').trim();

export function wireSubmitForm(form: HTMLFormElement, options: SubmitFormOptions): void {
  const status = form.querySelector<HTMLElement>('[data-form-status]');

  // Copy translated at build time, handed over as JSON on a data attribute:
  // the dictionaries never leave the build, so this script cannot import them.
  const copy: Record<string, string> = JSON.parse(form.dataset.i18n ?? '{}');

  function show(message: string, tone: 'ok' | 'error' | 'info'): void {
    if (!status) return;
    status.hidden = false;
    status.dataset.tone = tone;
    status.textContent = message;
  }

  function appendLink(href: string, label: string): void {
    if (!status) return;
    const link = document.createElement('a');
    link.href = href;
    link.rel = 'noopener';
    link.textContent = label;
    status.append(link);
  }

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();

    const data = new FormData(form);
    const missing = options.missing(data);

    for (const field of options.requiredInputs) {
      const input = form.elements.namedItem(field) as HTMLInputElement | null;
      input?.setAttribute('aria-invalid', String(!text(data, field)));
    }

    if (missing.length > 0) {
      show((copy.missing ?? '__f__').replace('__f__', missing.join(', ')), 'error');
      return;
    }

    const issueUrl = options.issueUrl(data);

    if (!SUBMIT_ENDPOINT) {
      show(copy.redirecting ?? '', 'info');
      window.location.assign(issueUrl);
      return;
    }

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    show(copy.sending ?? '', 'info');

    try {
      const response = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: options.kind,
          ...options.answers(data),
          contact: text(data, 'contact'),
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = (await response.json()) as { issueUrl?: string };
      show(result.issueUrl ? (copy.okWithLink ?? '') : (copy.ok ?? ''), 'ok');
      if (result.issueUrl) appendLink(result.issueUrl, copy.openIssue ?? '');

      form.reset();
    } catch {
      // The fallback is not a dead end: we send the person to GitHub with their
      // answers already filled in, so the work they did is not lost.
      show(copy.failed ?? '', 'error');
      appendLink(issueUrl, copy.failedLink ?? '');
    } finally {
      if (button) button.disabled = false;
    }
  });
}
