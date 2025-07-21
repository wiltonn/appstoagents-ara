// API endpoint for capturing guest user emails
// Part of Task 2.4: Guest User Flow Enhancement

import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, sessionId } = body;

    if (!email || !sessionId) {
      return new Response(JSON.stringify({ 
        error: 'Email and session ID are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if session exists
    const session = await prisma.auditSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return new Response(JSON.stringify({ 
        error: 'Session not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update session with guest email
    await prisma.auditSession.update({
      where: { id: sessionId },
      data: {
        guestEmail: email,
        emailCapturedAt: new Date(),
      },
    });

    // Log the email capture for analytics
    console.log(`📧 Guest email captured: ${email} for session ${sessionId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Email saved successfully' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error saving guest email:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to save email'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};