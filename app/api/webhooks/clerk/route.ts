

import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

    if (!WEBHOOK_SECRET) {
        throw new Error('Please add CLERK_WEBHOOK_SECRET to .env')
    }

    const headerPayload = headers()
    const svix_id = (await headerPayload).get("svix-id")
    const svix_timestamp = (await headerPayload).get("svix-timestamp")
    const svix_signature = (await headerPayload).get("svix-signature")

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error: Missing svix headers', {
            status: 400
        })
    }

    const payload = await req.json()
    const body = JSON.stringify(payload)

    const wh = new Webhook(WEBHOOK_SECRET)

    let evt: WebhookEvent

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent
    } catch (err) {
        console.error('Error verifying webhook:', err)
        return new Response('Error: Verification failed', {
            status: 400
        })
    }

    const eventType = evt.type

    if (eventType === 'user.created') {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data

        if (!email_addresses || email_addresses.length === 0) {
            return new Response('Error: No email address found', { status: 400 })
        }

        const email = email_addresses[0].email_address

        try {
            const existingUser = await prisma.user.findUnique({
                where: { email }
            })

            if (existingUser) {
                const updatedUser = await prisma.user.update({
                    where: { email },
                    data: {
                        clerkId: id,
                        firstName: first_name || existingUser.firstName,
                        lastName: last_name || existingUser.lastName,
                    }
                })
                console.log('User linked:', updatedUser.email)

                await prisma.logEvents.create({
                    data: {
                        message: `User linked via Clerk: ${updatedUser.email}`,
                        level: 'Info',
                        timeStamp: new Date(),
                        properties: JSON.stringify({
                            action: 'user_linked',
                            userId: updatedUser.id,
                        })
                    }
                })

                return new Response('User linked successfully', { status: 200 })
            }

            const user = await prisma.user.create({
                data: {
                    clerkId: id,
                    email: email,
                    firstName: first_name || null,
                    lastName: last_name || null,
                    role: 'ORGANISATION_USER', 
                }
            })

            console.log('User created:', user.email)

            await prisma.logEvents.create({
                data: {
                    message: `New user signed up: ${user.email}`,
                    level: 'Info',
                    timeStamp: new Date(),
                    properties: JSON.stringify({
                        action: 'user_signup',
                        userId: user.id,
                    })
                }
            })

            return new Response('User created successfully', { status: 200 })
        } catch (error) {
            console.error('Failed to create/link user:', error)
            return new Response('Error creating/linking user', { status: 500 })
        }
    }

    if (eventType === 'user.updated') {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data

        try {
            const user = await prisma.user.update({
                where: { clerkId: id },
                data: {
                    email: email_addresses[0].email_address,
                    firstName: first_name || null,
                    lastName: last_name || null,
                }
            })

            console.log('User updated:', user.email)

            return new Response('User updated successfully', { status: 200 })
        } catch (error) {
            console.error('Failed to update user:', error)
            return new Response('Error updating user', { status: 500 })
        }
    }

    if (eventType === 'user.deleted') {
        const { id } = evt.data

        try {
         
            await prisma.user.delete({
                where: { clerkId: id as string }
            })

            console.log('User deleted:', id)

            return new Response('User deleted successfully', { status: 200 })
        } catch (error) {
            console.error('Failed to delete user:', error)
            return new Response('Error deleting user', { status: 500 })
        }
    }

    return new Response('Webhook received', { status: 200 })
}

