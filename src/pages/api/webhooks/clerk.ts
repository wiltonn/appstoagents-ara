import type { APIRoute } from 'astro';
import { Webhook } from 'svix';
import { db } from '../../../utils/db';

export const POST: APIRoute = async ({ request }) => {
  const WEBHOOK_SECRET = import.meta.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to your environment variables');
  }

  // Get the headers
  const headerPayload = request.headers;
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await request.text();
  const body = JSON.parse(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  // Handle the webhook
  const { type, data } = evt;

  try {
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    return new Response('Success', { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Error occurred', { status: 500 });
  }
};

async function handleUserCreated(data: any) {
  const { id, email_addresses, first_name, last_name, image_url } = data;
  
  const primaryEmail = email_addresses.find((email: any) => email.id === data.primary_email_address_id);

  await db.user.create({
    data: {
      clerkId: id,
      email: primaryEmail?.email_address || '',
      firstName: first_name || '',
      lastName: last_name || '',
      profileImageUrl: image_url || null,
    },
  });

  console.log(`✅ User created: ${primaryEmail?.email_address}`);
}

async function handleUserUpdated(data: any) {
  const { id, email_addresses, first_name, last_name, image_url } = data;
  
  const primaryEmail = email_addresses.find((email: any) => email.id === data.primary_email_address_id);

  await db.user.update({
    where: { clerkId: id },
    data: {
      email: primaryEmail?.email_address || '',
      firstName: first_name || '',
      lastName: last_name || '',
      profileImageUrl: image_url || null,
      updatedAt: new Date(),
    },
  });

  console.log(`✅ User updated: ${primaryEmail?.email_address}`);
}

async function handleUserDeleted(data: any) {
  const { id } = data;

  // Soft delete - mark as deleted but keep audit data
  await db.user.update({
    where: { clerkId: id },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✅ User deleted: ${id}`);
}