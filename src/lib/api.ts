import matter from 'gray-matter'

export interface PostData {
    title?: string
    createdAt?: string
}

function toOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string') return value
    // YAML parses unquoted dates (2024-01-01) as Date objects
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
    return undefined
}

export function getPostBySlug(slug: string): { data: PostData, content: string } {
    const postsDirectory = import.meta.glob('../_posts/*.md', { eager: true, as: 'raw' });
    const markdownFiles = Object.keys(postsDirectory).find(path => path.includes(slug))

    if (!markdownFiles) {
        throw new Error(`No post found for slug ${slug}`)
    }

    const fullPath = postsDirectory[markdownFiles]

    const { data, content } = matter(fullPath)
    const frontMatter: Record<string, unknown> = data


    return {
        data: {
            title: toOptionalString(frontMatter.title),
            createdAt: toOptionalString(frontMatter.createdAt),
        },
        content
    }
}
