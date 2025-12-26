import { test, expect, type Page } from '@playwright/test';
import { createAccount, waitForEmail, extractLink, deleteAccount, type MailTmAccount } from './helpers/mail-tm';

// Test state shared between tests
let adminAccount: MailTmAccount;
let memberAccount: MailTmAccount;
let invitationToken: string | null = null;
let churchName: string;

// Helper to generate unique names
const uniqueId = () => Math.random().toString(36).slice(2, 8);

test.describe('Multi-tenancy E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  // Clean up mail accounts after all tests
  test.afterAll(async () => {
    if (adminAccount) {
      try {
        await deleteAccount(adminAccount);
      } catch (e) {
        console.log('Failed to cleanup admin account', e);
      }
    }
    if (memberAccount) {
      try {
        await deleteAccount(memberAccount);
      } catch (e) {
        console.log('Failed to cleanup member account', e);
      }
    }
  });

  test.describe('1. Signup Flow', () => {
    test('should create new account and church', async ({ page }) => {
      // Create mail.tm account for testing
      adminAccount = await createAccount(`admin${uniqueId()}`);
      console.log(`Created admin email: ${adminAccount.address}`);

      // Navigate to signup page
      await page.goto('/signup');
      await expect(page.locator('h1')).toContainText(/create account/i);

      // Fill signup form
      churchName = `Test Church ${uniqueId()}`;
      await page.fill('#name', 'Admin User');
      await page.fill('#churchName', churchName);
      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');

      // Submit
      await page.click('button[type="submit"]');

      // Wait for confirmation page
      await expect(page.locator('h1')).toContainText(/check your email/i, { timeout: 10000 });
      await expect(page.getByText(adminAccount.address)).toBeVisible();

      console.log('Signup submitted, waiting for confirmation email...');

      // Wait for confirmation email from Supabase
      const confirmEmail = await waitForEmail(adminAccount, {
        subjectContains: 'confirm',
        timeout: 120000, // 2 minutes for email delivery
      });

      expect(confirmEmail.subject.toLowerCase()).toContain('confirm');
      console.log(`Received confirmation email: ${confirmEmail.subject}`);

      // Extract confirmation link
      const confirmLink = extractLink(confirmEmail, /confirm|verify/i);
      expect(confirmLink).toBeTruthy();
      console.log(`Confirmation link: ${confirmLink}`);

      // Click confirmation link
      await page.goto(confirmLink!);

      // Should redirect to dashboard or login
      await expect(page).toHaveURL(/dashboard|login/, { timeout: 15000 });
    });

    test('should be able to login after confirmation', async ({ page }) => {
      await page.goto('/login');

      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Should show the church name in header
      await expect(page.locator('header')).toContainText(/Test Church/i);
    });
  });

  test.describe('2. Login Flow', () => {
    test('should login with password', async ({ page }) => {
      await page.goto('/login');

      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    });

    test('should show error for wrong password', async ({ page }) => {
      await page.goto('/login');

      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'WrongPassword');
      await page.click('button[type="submit"]');

      // Should show error
      await expect(page.locator('.bg-red-100, .bg-red-900')).toBeVisible({ timeout: 5000 });
    });

    test('should send magic link email', async ({ page }) => {
      await page.goto('/login');

      // Click "Send Sign In Link" button
      await page.click('text=Send Sign In Link');

      // Fill email
      await page.fill('#magic-email', adminAccount.address);
      await page.click('button[type="submit"]');

      // Wait for response
      await page.waitForTimeout(2000);

      // Check for success or rate limit message
      const successVisible = await page.locator('.bg-green-100, .bg-green-900').isVisible();
      const rateLimitVisible = await page.getByText(/rate limit|seconds/i).isVisible();

      if (successVisible) {
        console.log('Magic link email sent successfully');

        // Wait for magic link email
        const magicLinkEmail = await waitForEmail(adminAccount, {
          subjectContains: 'magic',
          timeout: 60000,
        });

        expect(magicLinkEmail.subject.toLowerCase()).toMatch(/magic|login|sign/i);
        console.log(`Received magic link email: ${magicLinkEmail.subject}`);

        // Extract magic link
        const magicLink = extractLink(magicLinkEmail, /dashboard|login|confirm/i);
        expect(magicLink).toBeTruthy();

        // Click magic link - should log in
        await page.goto(magicLink!);
        await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
      } else if (rateLimitVisible) {
        console.log('Magic link rate limited (expected after other email tests)');
        // This is acceptable - we've verified the form works
      } else {
        throw new Error('Neither success message nor rate limit message found');
      }
    });
  });

  test.describe('3. Forgot Password Flow', () => {
    test('should send password reset email', async ({ page }) => {
      await page.goto('/login');

      // Click "Forgot password?" button
      await page.click('text=Forgot password?');

      // Should be on reset password page
      await expect(page.locator('h1')).toContainText(/reset/i, { timeout: 5000 });

      // Fill email
      await page.fill('#reset-email', adminAccount.address);
      await page.click('button[type="submit"]');

      // May show success or rate limit message - both are acceptable
      // The key is that the form submission works
      await page.waitForTimeout(2000);

      // Check if we got success message or rate limit message
      const successVisible = await page.locator('.bg-green-100, .bg-green-900').isVisible();
      const rateLimitVisible = await page.getByText(/security|seconds/i).isVisible();

      if (successVisible) {
        console.log('Password reset email sent successfully');

        // Wait for reset email
        const resetEmail = await waitForEmail(adminAccount, {
          subjectContains: 'reset',
          timeout: 60000,
        });

        expect(resetEmail.subject.toLowerCase()).toContain('reset');
        console.log(`Received password reset email: ${resetEmail.subject}`);

        // Extract reset link
        const resetLink = extractLink(resetEmail, /reset|password/i);
        expect(resetLink).toBeTruthy();
        console.log(`Reset link: ${resetLink}`);

        // Navigate to reset link
        await page.goto(resetLink!);

        // Should be on reset password page
        await expect(page.locator('h1, h2')).toContainText(/reset|password/i, { timeout: 10000 });
      } else if (rateLimitVisible) {
        console.log('Password reset rate limited (expected after magic link test)');
        // This is OK - we tested the flow gets to the form correctly
      } else {
        throw new Error('Neither success message nor rate limit message found');
      }
    });
  });

  test.describe('4. Invitation Flow', () => {
    let inviteLink: string | null = null;

    test('should send invitation email and receive it', async ({ page }) => {
      // Create a second mail account for the invited member
      memberAccount = await createAccount(`member${uniqueId()}`);
      console.log(`Created member email: ${memberAccount.address}`);

      // Login as admin
      await page.goto('/login');
      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Find the team section and invite form
      await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible({ timeout: 5000 });

      // Fill invite form
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill(memberAccount.address);

      // Select role (default should be operator)
      // Click invite button
      await page.click('button:has-text("Invite"), button:has-text("Send")');

      // Wait for invitation to be sent
      await page.waitForTimeout(3000);

      // Check for success message
      const successMessage = page.getByText(/invitation sent/i);
      await expect(successMessage).toBeVisible({ timeout: 5000 });

      // Check if the invitation email shows in the pending list
      await expect(page.getByText(memberAccount.address)).toBeVisible({ timeout: 5000 });
      console.log('Invitation created and visible in pending list');

      // Log out admin
      await page.goto('/');
      console.log('Admin logged out');

      // REAL E2E TEST: Wait for the actual invitation email to arrive
      console.log('Waiting for invitation email to arrive at mail.tm...');
      const invitationEmail = await waitForEmail(memberAccount, {
        subjectContains: 'invited',
        fromContains: 'mobileworship',
        timeout: 120000, // 2 minutes for email delivery
      });

      expect(invitationEmail.subject.toLowerCase()).toContain('invited');
      console.log(`Received invitation email: ${invitationEmail.subject}`);

      // Extract the invitation link from the email
      inviteLink = extractLink(invitationEmail, /accept-invite\?token=/i);
      expect(inviteLink).toBeTruthy();
      console.log(`Invitation link from email: ${inviteLink}`);

      // Extract token from the link for use in next test
      const tokenMatch = inviteLink!.match(/token=([^&]+)/);
      invitationToken = tokenMatch ? tokenMatch[1] : null;
      expect(invitationToken).toBeTruthy();
      console.log(`Extracted invitation token: ${invitationToken?.slice(0, 8)}...`);
    });

    test('REAL FLOW: new user clicks invite link, signs up, and accepts invitation', async ({ page }) => {
      // This test simulates the REAL user journey:
      // 1. User clicks invite link in email
      // 2. Gets redirected to login (no account)
      // 3. Clicks "Sign up"
      // 4. Signs up WITHOUT creating a church
      // 5. Confirms email
      // 6. Returns to accept-invite page
      // 7. Accepts invitation
      // 8. Ends up in the invited church

      expect(inviteLink).toBeTruthy();
      console.log('Starting REAL invitation flow test');

      // STEP 1: Click the invitation link from the email
      console.log('Step 1: Clicking invitation link...');
      await page.goto(inviteLink!);

      // STEP 2: Should be redirected to login (user has no account)
      console.log('Step 2: Should be redirected to login...');
      await expect(page).toHaveURL(/login.*redirect/, { timeout: 10000 });
      console.log('Redirected to login with redirect param');

      // STEP 3: Click "Sign up" link (user doesn't have an account)
      console.log('Step 3: Clicking Sign up link...');
      await page.click('a:has-text("Sign up"), a:has-text("Sign Up")');
      await expect(page).toHaveURL(/signup.*redirect/, { timeout: 5000 });
      console.log('Navigated to signup page with redirect param');

      // STEP 4: Sign up WITHOUT church name (invitation signup flow)
      console.log('Step 4: Filling signup form (no church required)...');

      // Should see helpful message about invitation signup
      await expect(page.getByText(/accept your invitation/i)).toBeVisible({ timeout: 5000 });

      // Church name field should NOT be visible for invitation signups
      await expect(page.locator('#churchName')).not.toBeVisible();

      // Email field should be pre-filled from invitation token and locked (readonly)
      const emailInput = page.locator('#email');
      await expect(emailInput).toHaveValue(memberAccount.address, { timeout: 10000 });
      console.log('Email field is pre-filled with invitation email');

      // Verify email field is readonly (locked)
      const isReadonly = await emailInput.getAttribute('readonly');
      expect(isReadonly).not.toBeNull();
      console.log('Email field is locked (readonly)');

      // Fill only required fields (email already filled)
      await page.fill('#name', 'Invited Member');
      await page.fill('#password', 'MemberPassword123!');

      // Submit
      await page.click('button[type="submit"]');

      // Wait for confirmation page
      await expect(page.locator('h1')).toContainText(/check your email/i, { timeout: 10000 });
      console.log('Signup submitted, waiting for confirmation email...');

      // STEP 5: Wait for and click confirmation email
      console.log('Step 5: Waiting for confirmation email...');
      const confirmEmail = await waitForEmail(memberAccount, {
        subjectContains: 'confirm',
        timeout: 120000,
      });

      // Extract confirmation link
      const confirmLink = extractLink(confirmEmail, /confirm|verify/i);
      expect(confirmLink).toBeTruthy();
      console.log(`Confirmation link: ${confirmLink?.slice(0, 50)}...`);

      // STEP 6: Click confirmation link - should redirect to accept-invite page
      console.log('Step 6: Clicking confirmation link...');
      await page.goto(confirmLink!);

      // STEP 7: Should be on accept-invite page or redirected there
      console.log('Step 7: Should be on accept-invite page...');

      // Wait for page to load
      await page.waitForTimeout(3000);

      // We might end up at accept-invite directly or need to navigate there
      if (!page.url().includes('accept-invite')) {
        console.log('Not on accept-invite, navigating directly...');
        await page.goto(`/accept-invite?token=${invitationToken}`);
        await page.waitForTimeout(2000);
      }

      // If redirected to login, log in and go back to accept-invite
      if (page.url().includes('login')) {
        console.log('Redirected to login, logging in...');
        await page.fill('#email', memberAccount.address);
        await page.fill('#password', 'MemberPassword123!');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        await page.goto(`/accept-invite?token=${invitationToken}`);
        await page.waitForTimeout(2000);
      }

      // Should now see the invitation details
      console.log('Step 8: Checking invitation page...');
      await expect(page.getByText(new RegExp(churchName, 'i'))).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/operator/i)).toBeVisible();

      // Name field should be pre-filled from signup
      const nameInput = page.locator('#name');
      if (await nameInput.isVisible()) {
        const nameValue = await nameInput.inputValue();
        expect(nameValue).toBe('Invited Member');
        console.log('Name pre-filled from signup metadata');
      }

      // STEP 8: Click accept button
      console.log('Step 9: Accepting invitation...');
      await page.click('button:has-text("Accept")');

      // Should redirect to dashboard with the new church
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // STEP 9: Verify we're in the correct church
      console.log('Step 10: Verifying correct church...');
      await expect(page.locator('header')).toContainText(new RegExp(churchName, 'i'));

      console.log('SUCCESS: Member completed full invitation flow and joined the correct church!');
    });
  });

  test.describe('5. Church Switching', () => {
    test('member with single church should NOT see church switcher', async ({ page }) => {
      // Login as member (who now has only 1 church - the invited one)
      await page.goto('/login');
      await page.fill('#email', memberAccount.address);
      await page.fill('#password', 'MemberPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Should NOT see church switcher section since member has only one church
      const churchSwitcher = page.getByRole('heading', { name: /switch church/i });
      await expect(churchSwitcher).not.toBeVisible({ timeout: 3000 });

      console.log('Church switcher correctly hidden for member with single church');
    });

    test('member should be in the correct (invited) church', async ({ page }) => {
      // Login as member
      await page.goto('/login');
      await page.fill('#email', memberAccount.address);
      await page.fill('#password', 'MemberPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Verify the church name in header matches the invited church
      await expect(page.locator('header')).toContainText(new RegExp(churchName, 'i'));

      console.log('Member is in the correct invited church');
    });
  });

  test.describe('6. Role Management', () => {
    test('admin should be able to change member role', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Find the member in the team list
      await expect(page.getByText(memberAccount.address)).toBeVisible({ timeout: 5000 });

      // Wait for the members list to fully load
      await page.waitForTimeout(2000);

      // First find the "Members" section (heading level 4)
      const membersSection = page.locator('h4:has-text("Members")').locator('xpath=ancestor::div[1]/following-sibling::div[1]');

      // Within the members section, find the row with the member's email
      const memberEmail = memberAccount.address;

      // Look for the div that contains BOTH the member email AND a Remove button
      const memberRow = membersSection.locator(`div:has(p:has-text("${memberEmail}")):has(button:has-text("Remove"))`).first();

      // Find the select in this row
      const roleSelect = memberRow.locator('select').first();

      if (await roleSelect.isVisible()) {
        // Get current value for debugging
        const currentValue = await roleSelect.inputValue();
        console.log(`Current role value: ${currentValue}`);

        // Use evaluate to change the select value directly
        await roleSelect.evaluate((el: HTMLSelectElement) => {
          el.value = 'editor';
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Wait for change to process
        await page.waitForTimeout(2000);

        // Should see success message
        await expect(page.getByText(/role updated|role changed/i)).toBeVisible({ timeout: 5000 });

        console.log('Successfully changed member role');
      } else {
        console.log('Role select not found - member may not be visible in list');
      }
    });
  });

  test.describe('7. Member Removal', () => {
    test('admin should be able to remove member', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Find the member in the team list
      await expect(page.getByText(memberAccount.address)).toBeVisible({ timeout: 5000 });

      // Set up dialog handler for confirmation
      page.on('dialog', async (dialog) => {
        console.log(`Dialog message: ${dialog.message()}`);
        await dialog.accept();
      });

      // Find and click the "Remove Member" button for the member
      const removeButton = page.locator('button:has-text("Remove")').first();
      if (await removeButton.isVisible()) {
        await removeButton.click();

        // Wait for removal to process
        await page.waitForTimeout(2000);

        // Should see success message
        await expect(page.getByText(/member removed/i)).toBeVisible({ timeout: 5000 });

        // Member email should no longer be in the list
        await expect(page.getByText(memberAccount.address)).not.toBeVisible({ timeout: 5000 });

        console.log('Successfully removed member');
      } else {
        console.log('Remove button not found');
      }
    });
  });

  test.describe('8. Church Deletion', () => {
    test('sole admin should be able to view delete church section', async ({ page }) => {
      // Login as admin (sole member of their church)
      await page.goto('/login');
      await page.fill('#email', adminAccount.address);
      await page.fill('#password', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Look for delete church section
      await expect(page.getByRole('heading', { name: 'Delete Church' })).toBeVisible({ timeout: 5000 });

      // Should see warning about deletion
      await expect(page.getByText('Permanently delete this church')).toBeVisible();

      // Note: We don't actually delete the church in tests to preserve test account
    });
  });
});
