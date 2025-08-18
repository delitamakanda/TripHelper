import matter from 'gray-matter'

export function getPostBySlug(slug: string): { data: any, content: string } {
    const postsDirectory = import.meta.glob('../_posts/*.md', { eager: true, as: 'raw' });
    const markdownFiles = Object.keys(postsDirectory).find(path => path.includes(slug))

    if (!markdownFiles) {
        throw new Error(`No post found for slug ${slug}`)
    }

    const fullPath = postsDirectory[markdownFiles]

    const { data, content } = matter(fullPath)


    return {
        data,
        content
    }
}