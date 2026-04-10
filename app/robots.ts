import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/api/upload/google-drive/view'],
                disallow: ['/admin/', '/dashboard/', '/api/'],
            }
        ],
        sitemap: 'https://campzeo.com/sitemap.xml',
    }
}
