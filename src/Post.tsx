import { useParams } from "react-router-dom";
import { getPostBySlug} from './lib/api.ts';
import { useRemarkSync} from "react-remark";

const siteMetadata = {
    locale: 'fr-FR',
}


function Post(){
    const { permalink } = useParams();
    const { data, content } = getPostBySlug(permalink!);
    return (
        <div className="mx-auto px-4 py-6 space-y-6 dark:bg-black dark:text-white">
            <article>
                <div className="xl:divide-y xl:divide-gray-200 xl:dark:divide-gray-700">
                    <header className="pt-6 xl:pb-6">
                        <div className="space-y-1 text-center">
                            <dl className="space-y-10">
                                <div>
                                    <dt className="sr-only">Published on</dt>
                                    <dd className="text-base font-medium leading-6 text-gray-500 dark:text-gray-400">
                                        <time dateTime={data?.createdAt}>
                                            {new Date(data?.createdAt).toLocaleDateString(siteMetadata.locale, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: '2-digit',
                                            })}
                                        </time>
                                    </dd>
                                </div>
                            </dl>
                            <div>
                                <h2>{data?.title}</h2>
                            </div>
                        </div>
                    </header>
                    <div className="grid-rows-[auto_1fr] divide-y divide-gray-200 pb-8 dark:divide-gray-700 xl:grid xl:grid-cols-4 xl:gap-x-6 xl:divide-y-0">
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 xl:col-span-3 xl:row-span-2 xl:pb-0">
                            <div className="prose max-w-none pb-8 pt-10 dark:prose-invert">{useRemarkSync(content)}</div>
                        </div>
                    </div>
                </div>
            </article>
        </div>
    )
}

export default Post;