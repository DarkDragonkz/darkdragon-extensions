import { SourceInfo } from '@paperback/types';
import { NineManga } from '../NineManga';
export declare const NineMangaITInfo: SourceInfo;
export declare class NineMangaIT extends NineManga {
    baseUrl: string;
    languageCode: string;
    genreTag: string;
    authorTag: string;
    statusTag: string;
    parseStatus(str: string): string;
    protected convertTime(timeAgo: string): Date;
}
