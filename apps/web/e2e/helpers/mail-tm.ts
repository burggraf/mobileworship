/**
 * Mail.tm API helper for E2E email testing
 * https://docs.mail.tm/
 */

const API_BASE = 'https://api.mail.tm';

export interface MailTmAccount {
  id: string;
  address: string;
  password: string;
  token: string;
}

export interface MailTmMessage {
  id: string;
  from: { address: string; name: string };
  to: { address: string; name: string }[];
  subject: string;
  intro: string;
  text?: string;
  html?: string[];
  createdAt: string;
}

/**
 * Get available domains for email addresses
 */
export async function getDomains(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/domains`);
  if (!response.ok) {
    throw new Error(`Failed to get domains: ${response.status}`);
  }
  const data = await response.json();
  return data['hydra:member'].map((d: { domain: string }) => d.domain);
}

/**
 * Create a new temporary email account
 */
export async function createAccount(prefix?: string): Promise<MailTmAccount> {
  const domains = await getDomains();
  const domain = domains[0];
  const randomPrefix = prefix || `test${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const address = `${randomPrefix}@${domain}`;
  const password = `Pass${Date.now()}!`;

  // Create account
  const createResponse = await fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create account: ${createResponse.status} - ${error}`);
  }

  const accountData = await createResponse.json();

  // Get auth token
  const tokenResponse = await fetch(`${API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();

  return {
    id: accountData.id,
    address,
    password,
    token: tokenData.token,
  };
}

/**
 * Get messages from inbox
 */
export async function getMessages(account: MailTmAccount): Promise<MailTmMessage[]> {
  const response = await fetch(`${API_BASE}/messages`, {
    headers: { Authorization: `Bearer ${account.token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`);
  }

  const data = await response.json();
  return data['hydra:member'];
}

/**
 * Get a specific message by ID
 */
export async function getMessage(account: MailTmAccount, messageId: string): Promise<MailTmMessage> {
  const response = await fetch(`${API_BASE}/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${account.token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get message: ${response.status}`);
  }

  return response.json();
}

/**
 * Wait for an email matching the subject pattern
 */
export async function waitForEmail(
  account: MailTmAccount,
  options: {
    subjectContains?: string;
    fromContains?: string;
    timeout?: number;
    pollInterval?: number;
  } = {}
): Promise<MailTmMessage> {
  const { subjectContains, fromContains, timeout = 60000, pollInterval = 2000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messages = await getMessages(account);

    for (const msg of messages) {
      const matchesSubject = !subjectContains || msg.subject.toLowerCase().includes(subjectContains.toLowerCase());
      const matchesFrom = !fromContains || msg.from.address.toLowerCase().includes(fromContains.toLowerCase());

      if (matchesSubject && matchesFrom) {
        // Get full message content
        return getMessage(account, msg.id);
      }
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Timeout waiting for email${subjectContains ? ` with subject containing "${subjectContains}"` : ''}`);
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Extract links from email HTML content
 */
export function extractLinks(message: MailTmMessage): string[] {
  const links: string[] = [];
  const htmlContent = message.html?.join('') || '';

  // Match href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(htmlContent)) !== null) {
    // Decode HTML entities in the URL
    links.push(decodeHtmlEntities(match[1]));
  }

  // Also check text content for URLs
  const textContent = message.text || '';
  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  while ((match = urlRegex.exec(textContent)) !== null) {
    const decodedUrl = decodeHtmlEntities(match[0]);
    if (!links.includes(decodedUrl)) {
      links.push(decodedUrl);
    }
  }

  return links;
}

/**
 * Extract a specific link (e.g., confirmation, magic link) from email
 */
export function extractLink(message: MailTmMessage, pattern: string | RegExp): string | null {
  const links = extractLinks(message);
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

  for (const link of links) {
    if (regex.test(link)) {
      return link;
    }
  }

  return null;
}

/**
 * Delete an account (cleanup)
 */
export async function deleteAccount(account: MailTmAccount): Promise<void> {
  const response = await fetch(`${API_BASE}/accounts/${account.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${account.token}` },
  });

  if (!response.ok && response.status !== 204) {
    console.warn(`Failed to delete account: ${response.status}`);
  }
}
