import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://campzeo.com'

    // Define public routes
    const routes = [
        '',
        '/pricing',
        '/contact',
        '/privacy-policy',
        '/terms-of-service',
    ]

    return routes.map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: route === '' ? 1 : 0.8,
    }))
}
