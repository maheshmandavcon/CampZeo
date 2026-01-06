/**
 * Authentication Utilities
 * 
 * Helper functions for authentication and authorization
 */

import { useAuth } from '@clerk/nextjs'
import { prisma } from './prisma'

/**
 * Get the current authenticated user from the database
 */
export async function getCurrentUser() {
  const { userId } = useAuth()

  if (!userId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      organisation: true
    }
  })

  return user
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN_USER'
}

/**
 * Check if the current user has an organisation
 */
export async function hasOrganisation() {
  const user = await getCurrentUser()
  return !!user?.organisationId
}

/**
 * Get the current user's organisation
 */
export async function getCurrentOrganisation() {
  const user = await getCurrentUser()

  if (!user?.organisationId) {
    return null
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: user.organisationId },
    include: {
      users: true
    }
  })

  return organisation
}

/**
 * Require admin role - throw error if not admin
 */
export async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN_USER') {
    throw new Error('Admin access required')
  }

  return user
}

/**
 * Require organisation - throw error if user doesn't have an organisation
 */
export async function requireOrganisation() {
  const user = await getCurrentUser()

  if (!user?.organisationId) {
    throw new Error('Organisation required')
  }

  return user
}

/**
 * Get user role for routing
 */
export async function getUserRole(): Promise<'admin' | 'organisation' | null> {
  const user = await getCurrentUser()

  if (!user) return null

  return user.role === 'ADMIN_USER' ? 'admin' : 'organisation'
}
