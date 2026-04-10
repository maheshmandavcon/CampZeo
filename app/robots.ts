import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: ['facebookexternalhit', 'Facebot'],
                allow: ['/api/upload/google-drive/view'],
            },
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/admin/', '/dashboard/', '/api/'],
            }
        ],
        sitemap: 'https://campzeo.com/sitemap.xml',
    }
}
