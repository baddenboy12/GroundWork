"use node";

import escapeHtml from "escape-html";
import { Resend } from "resend";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

// Sender address — must be verified in Resend dashboard
const FROM = process.env.GROUNDWORK_EMAIL_FROM ?? "verify@noreply.teezfpo.com";

// ── Shared HTML template helpers ──────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:#f4f0e8;letter-spacing:-0.3px;">
                GroundWork
              </span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#555;">
                You're receiving this because you have successfully registered a GroundWork account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function siteChip(siteName: string): string {
  return `<span style="display:inline-block;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:6px;padding:2px 10px;font-size:13px;font-weight:600;color:#f4f0e8;">${escapeHtml(siteName)}</span>`;
}

function ctaButton(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:24px;background:#c8840a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${escapeHtml(label)}</a>`;
}

// ── Email 1: Deletion vote proposed ───────────────────────────────────────────

export const sendVoteProposed = internalAction({
  args: {
    to: v.array(v.string()),       // recipient emails (all members except proposer)
    siteName: v.string(),
    proposerName: v.string(),
    expiresAt: v.string(),          // ISO-8601
    appUrl: v.string(),
  },
  handler: async (_ctx, { to, siteName, proposerName, expiresAt, appUrl }) => {
    if (to.length === 0) return;
    const expires = new Date(expiresAt).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      hour12: true, timeZone: "UTC", timeZoneName: "short",
    });
    const body = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f0e8;">
        Deletion vote started
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">
        <strong style="color:#f4f0e8;">${escapeHtml(proposerName)}</strong>
        has proposed deleting the team site ${siteChip(siteName)}.
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#888;line-height:1.6;">
        All team members must approve before the site is deleted. The vote
        expires on <strong style="color:#f4f0e8;">${escapeHtml(expires)}</strong>.
      </p>
      <div style="margin-top:16px;padding:16px;background:#111;border:1px solid #2a2a2a;border-radius:8px;font-size:13px;color:#999;line-height:1.5;">
        ⚠️ If this vote reaches unanimous approval, the site and all its log
        entries will be <strong style="color:#f4f0e8;">permanently deleted</strong>.
        You can cancel the vote if you disagree.
      </div>
      ${ctaButton("Review the vote", appUrl)}
    `;
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `[GroundWork] Deletion vote started for "${siteName}"`,
      html: baseTemplate(`Deletion vote started for ${siteName}`, body),
    });
  },
});

// ── Email 2: A team member cast their vote ─────────────────────────────────────

export const sendVoteCast = internalAction({
  args: {
    to: v.array(v.string()),        // proposer's email (and optionally others)
    siteName: v.string(),
    voterName: v.string(),
    approvedCount: v.number(),
    memberCount: v.number(),
    appUrl: v.string(),
  },
  handler: async (_ctx, { to, siteName, voterName, approvedCount, memberCount, appUrl }) => {
    if (to.length === 0) return;
    const remaining = memberCount - approvedCount;
    const body = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f0e8;">
        New approval — ${approvedCount}/${memberCount}
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">
        <strong style="color:#f4f0e8;">${escapeHtml(voterName)}</strong>
        has approved the deletion of ${siteChip(siteName)}.
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#888;line-height:1.6;">
        ${remaining > 0
          ? `<strong style="color:#f4f0e8;">${remaining}</strong> more member${remaining === 1 ? "" : "s"} need to approve before the site is deleted.`
          : "All members have approved — the site will be deleted shortly."}
      </p>
      ${ctaButton("View vote status", appUrl)}
    `;
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `[GroundWork] Vote update: "${siteName}" — ${approvedCount}/${memberCount} approved`,
      html: baseTemplate(`Vote update for ${siteName}`, body),
    });
  },
});

// ── Email 3: Vote completed — site deleted ─────────────────────────────────────

export const sendSiteDeleted = internalAction({
  args: {
    to: v.array(v.string()),
    siteName: v.string(),
    appUrl: v.string(),
  },
  handler: async (_ctx, { to, siteName, appUrl }) => {
    if (to.length === 0) return;
    const body = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f0e8;">
        Site deleted
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">
        All team members approved the deletion of ${siteChip(siteName)}.
        The site and all its log entries have been permanently removed.
      </p>
      <div style="padding:16px;background:#1a1010;border:1px solid #3a2020;border-radius:8px;font-size:13px;color:#999;line-height:1.5;">
        This action cannot be undone. If this was a mistake, you will need to
        recreate the site from your dashboard.
      </div>
      ${ctaButton("Go to dashboard", appUrl)}
    `;
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `[GroundWork] Site "${siteName}" has been deleted`,
      html: baseTemplate(`Site "${siteName}" deleted`, body),
    });
  },
});

// ── Email 4: Vote expired without unanimity ────────────────────────────────────

export const sendVoteExpired = internalAction({
  args: {
    to: v.array(v.string()),
    siteName: v.string(),
    approvedCount: v.number(),
    memberCount: v.number(),
    appUrl: v.string(),
  },
  handler: async (_ctx, { to, siteName, approvedCount, memberCount, appUrl }) => {
    if (to.length === 0) return;
    const body = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f0e8;">
        Deletion vote expired
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">
        The 24-hour deletion vote for ${siteChip(siteName)} expired without
        reaching unanimous approval (${approvedCount}/${memberCount} voted).
        The site has <strong style="color:#f4f0e8;">not been deleted</strong>.
      </p>
      <p style="font-size:13px;color:#888;line-height:1.6;">
        Any team member can start a new vote at any time from the Sites panel.
      </p>
      ${ctaButton("Go to dashboard", appUrl)}
    `;
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `[GroundWork] Deletion vote for "${siteName}" expired`,
      html: baseTemplate(`Deletion vote expired for ${siteName}`, body),
    });
  },
});

// ── Email 5: Vote cancelled ────────────────────────────────────────────────────

// ── Email 6: Welcome — new user registration ─────────────────────────────────

export const sendWelcome = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    appUrl: v.string(),
  },
  handler: async (_ctx, { to, userName, appUrl }) => {
    if (!to) return;
    const greeting = userName ? escapeHtml(userName) : "there";
    const body = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f0e8;">
        Welcome to GroundWork
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">
        Hey <strong style="color:#f4f0e8;">${greeting}</strong>, your account is all set up
        and ready to go.
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#888;line-height:1.6;">
        Here's what you can do next:
      </p>
      <ul style="margin:12px 0 0;padding-left:20px;font-size:13px;color:#888;line-height:1.8;">
        <li>Create your first <strong style="color:#f4f0e8;">site</strong> to start logging</li>
        <li>Add <strong style="color:#f4f0e8;">photos</strong> and notes to each log entry</li>
        <li>Invite <strong style="color:#f4f0e8;">team members</strong> to collaborate</li>
      </ul>
      ${ctaButton("Go to dashboard", appUrl)}
    `;
    await getResend().emails.send({
      from: FROM,
      to,
      subject: "Welcome to GroundWork",
      html: baseTemplate("Welcome to GroundWork", body),
    });
  },
});

export const sendVoteCancelled = internalAction({
  args: {
    to: v.array(v.string()),
    siteName: v.string(),
    cancellerName: v.string(),
    appUrl: v.string(),
  },
  handler: async (_ctx, { to, siteName, cancellerName, appUrl }) => {
    if (to.length === 0) return;
    const body = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f0e8;">
        Deletion vote cancelled
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.6;">
        <strong style="color:#f4f0e8;">${escapeHtml(cancellerName)}</strong>
        has cancelled the deletion vote for ${siteChip(siteName)}.
        The site will <strong style="color:#f4f0e8;">not be deleted</strong>.
      </p>
      ${ctaButton("Go to dashboard", appUrl)}
    `;
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `[GroundWork] Deletion vote for "${siteName}" was cancelled`,
      html: baseTemplate(`Deletion vote cancelled for ${siteName}`, body),
    });
  },
});
