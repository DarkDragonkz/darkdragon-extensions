import { MangaWorld, MangaWorldInfo } from './MangaWorld/MangaWorld'
import { NineMangaIT, NineMangaITInfo } from './NineMangaIT/NineMangaIT'
import { WeebCentral, WeebCentralInfo } from './WeebCentral/WeebCentral'
import { MangaDex, MangaDexInfo } from './MangaDex/MangaDex'
import { ReadAllComics, ReadAllComicsInfo } from './ReadAllComics/ReadAllComics'
import * as cheerio from 'cheerio'

export const MangaWorldSource = new MangaWorld(cheerio)
export const NineMangaITSource = new NineMangaIT(cheerio)
export const WeebCentralSource = new WeebCentral(cheerio)
export const MangaDexSource = new MangaDex(cheerio)
export const ReadAllComicsSource = new ReadAllComics(cheerio)

export const MangaWorldExtensionInfo = MangaWorldInfo
export const NineMangaITExtensionInfo = NineMangaITInfo
export const WeebCentralExtensionInfo = WeebCentralInfo
export const MangaDexExtensionInfo = MangaDexInfo
export const ReadAllComicsExtensionInfo = ReadAllComicsInfo