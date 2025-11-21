import { Chapter, ChapterDetails, HomeSection, PagedResults, SearchRequest, SourceInfo, SourceManga, SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding } from '@paperback/types';
import { WeebCentralParser } from './WeebCentralParser';
export declare const WeebCentralInfo: SourceInfo;
export declare class WeebCentral implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    private cheerio;
    baseUrl: string;
    parser: WeebCentralParser;
    constructor(cheerio: any);
    requestManager: import("@paperback/types").RequestManager;
    getMangaShareUrl(mangaId: string): string;
    getMangaDetails(mangaId: string): Promise<SourceManga>;
    getChapters(mangaId: string): Promise<Chapter[]>;
    getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails>;
    getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults>;
    getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void>;
    getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults>;
    getCloudflareBypassRequestAsync(): Promise<import("@paperback/types").Request>;
    constructSearchRequest(query: SearchRequest): any;
}
