import {
    SourceInfo,
    ContentRating,
    BadgeColor,
    SourceIntents
} from '@paperback/types'

// Importa le classi delle Source (NON i Parser)
import { BatCave, BatCaveInfo } from './BatCave'
import { Comix, ComixInfo } from './Comix'
import { MangaDex, MangaDexInfo } from './MangaDex'
import { MangaDexIT, MangaDexITInfo } from './MangaDexIT'
import { MangaPark, MangaParkInfo } from './MangaPark'
import { MangaWorld, MangaWorldInfo } from './MangaWorld'
import { NineMangaIT, NineMangaITInfo } from './NineMangaIT'
import { ReadAllComics, ReadAllComicsInfo } from './ReadAllComics'
import { ReadComicsOnline, ReadComicsOnlineInfo } from './ReadComicsOnline'
import { WeebCentral, WeebCentralInfo } from './WeebCentral'
import { MangaBall, MangaBallInfo } from './MangaBall'
// Aggiungi XoxoComic qui
import { XoxoComic, XoxoComicInfo } from './XoxoComic'

// Espone le istanze delle Source al bundler
// NOTA: Non esportare MAI le classi *Parser* qui!

export const BatCaveSource = new BatCave(cheerio)
export const ComixSource = new Comix(cheerio)
export const MangaDexSource = new MangaDex(cheerio)
export const MangaDexITSource = new MangaDexIT(cheerio)
export const MangaParkSource = new MangaPark(cheerio)
export const MangaWorldSource = new MangaWorld(cheerio)
export const NineMangaITSource = new NineMangaIT(cheerio)
export const ReadAllComicsSource = new ReadAllComics(cheerio)
export const ReadComicsOnlineSource = new ReadComicsOnline(cheerio)
export const WeebCentralSource = new WeebCentral(cheerio)
export const MangaBallSource = new MangaBall(cheerio)
// Esportazione corretta per XoxoComic
export const XoxoComicSource = new XoxoComic(cheerio)
