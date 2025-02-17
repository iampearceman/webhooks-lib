import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { Novu } from '@novu/node';

const novu = new Novu(process.env.NOVU_SECRET_KEY || '');

async function handleClerkEvent(eventData: any, eventType: string) {
  try {
    // Map Clerk event types to your Novu workflow IDs
    const workflowMapping: { [key: string]: string } = {
      // Organization Events
      'organization.created': 'org-created',
      'organization.updated': 'org-updated',
      'organization.deleted': 'org-deleted',

      // Organization Domain Events
      'organizationDomain.created': 'org-domain-created',
      'organizationDomain.updated': 'org-domain-updated',
      'organizationDomain.deleted': 'org-domain-deleted',

      // Organization Invitation Events
      'organizationInvitation.accepted': 'org-invite-accepted',
      'organizationInvitation.created': 'org-invite-created',
      'organizationInvitation.revoked': 'org-invite-revoked',

      // Organization Membership Events
      'organizationMembership.created': 'org-member-created',
      'organizationMembership.deleted': 'org-member-deleted',
      'organizationMembership.updated': 'org-member-updated',

      // Permission Events
      'permission.created': 'permission-created',
      'permission.deleted': 'permission-deleted',
      'permission.updated': 'permission-updated',

      // Role Events
      'role.created': 'role-created',
      'role.deleted': 'role-deleted',
      'role.updated': 'role-updated',

      // Session Events
      'session.created': 'session-created',
      'session.ended': 'session-ended',
      'session.pending': 'session-pending',
      'session.removed': 'session-removed',
      'session.revoked': 'session-revoked',

      // User Events
      'user.created': 'user-created',
      'user.updated': 'user-updated',
      'user.deleted': 'user-deleted',

      // Waitlist Events
      'waitlistEntry.created': 'waitlist-created',
      'waitlistEntry.updated': 'waitlist-updated'
    };

    const workflowId = workflowMapping[eventType] || 'test';
    
    // Extract the user ID from the event data and add Clerk prefix
    let subscriberId = 'default';
    if (eventData.id) {
      subscriberId = `clerk_user_${eventData.id}`;
    } else if (eventData.user_id) {
      subscriberId = `clerk_user_${eventData.user_id}`;
    } else if (eventData.data?.id) {
      subscriberId = `clerk_user_${eventData.data.id}`;
    }

    // Add additional context based on event type
    const additionalContext = {
      // Organization context
      organization_id: eventData.organization?.id || eventData.organization_id,
      organization_name: eventData.organization?.name,
      
      // User context
      user_id: eventData.user?.id || eventData.user_id,
      user_email: eventData.user?.email_addresses?.[0]?.email_address,
      
      // Role and Permission context
      role_key: eventData.role?.key,
      permission_key: eventData.permission?.key,
      
      // Session context
      session_id: eventData.session?.id,
      
      // Invitation context
      invitation_id: eventData.invitation?.id,
      inviter_email: eventData.inviter?.email_addresses?.[0]?.email_address,
      
      // Domain context
      domain: eventData.domain?.name
    };

    console.log('Processing Clerk event:', {
      type: eventType,
      subscriberId,
      data: eventData,
      context: additionalContext
    });

    // Build the 'to' object according to Novu's subscriber attributes specification
    const toObject: any = {
      subscriberId: subscriberId,
      email: 'emil@novu.co' // Override email for testing
    };

    // If there's any additional data we want to pass
    const clerkData: Record<string, any> = {
      clerk_created_at: eventData.created_at,
      clerk_user_id: eventData.user_id || eventData.id,
      clerk_organization_id: eventData.organization_id,
      clerk_organization_role: eventData.role,
      clerk_updated_at: eventData.updated_at
    };

    // Filter out undefined values
    const filteredClerkData = Object.fromEntries(
      Object.entries(clerkData).filter(([_, value]) => value !== undefined)
    );

    // Only add data field if we have data to add
    if (Object.keys(filteredClerkData).length > 0) {
      toObject.data = filteredClerkData;
    }

    // Add any existing metadata if available
    if (eventData.public_metadata || eventData.private_metadata) {
      toObject.data = {
        ...toObject.data,
        public_metadata: eventData.public_metadata,
        private_metadata: eventData.private_metadata
      };
    }

    // Build payload object based on event type
    const payload: any = {};

    // Set the app logo for testing
    payload.appLogo = 'https://avatars.githubusercontent.com/u/77433905?s=200&v=4';

    // Add organization name if available
    if (additionalContext.organization_name) {
      payload.app = {
        name: additionalContext.organization_name
      };
    }

    // Add specific payload fields based on event type
    switch (eventType) {
      case 'organizationInvitation.created':
        if (additionalContext.inviter_email) {
          payload.inviter_name = additionalContext.inviter_email;
          payload.escapeURIs_inviter_name = encodeURIComponent(additionalContext.inviter_email);
        }
        if (eventData.id) {
          payload.action_url = `${process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL}/accept-invite?token=${eventData.id}`;
        }
        break;

      case 'session.created':
      case 'session.pending':
        // Add magic link specific fields
        if (eventData.requested_at) payload.requested_at = eventData.requested_at;
        if (eventData.requested_by) payload.requested_by = eventData.requested_by;
        if (eventData.requested_from) payload.requested_from = eventData.requested_from;
        if (eventData.ttl_minutes) payload.ttl_minutes = eventData.ttl_minutes;
        if (eventData.magic_link) payload.magic_link = eventData.magic_link;
        if (eventData.user?.public_metadata) {
          payload.user = {
            public_metadata: eventData.user.public_metadata
          };
        }
        break;

      case 'waitlistEntry.created':
      case 'waitlistEntry.updated':
        // Add domain-specific information if available
        if (additionalContext.domain) {
          payload.app = {
            ...payload.app,
            domain_name: additionalContext.domain,
            url: `https://${additionalContext.domain}`
          };
        }
        break;
    }

    console.log('Sending to Novu:', JSON.stringify({ to: toObject, payload }, null, 2));

    await novu.trigger(workflowId, {
      to: toObject,
      payload
    });

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new SVIX instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  try {
    // Handle the event with Novu
    await handleClerkEvent(evt.data, evt.type);

    return NextResponse.json({
      status: 200,
      message: `Successfully processed ${evt.type} event`,
      eventId: evt.data.id
    });
  } catch (error: any) {
    console.error(`Error processing ${evt.type} event:`, error);
    return NextResponse.json({
      status: 500,
      message: error.message
    });
  }
}