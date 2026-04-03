declare const cheerio: any

import { BatCave } from './BatCave/BatCave'
import { Comix } from './Comix/Comix'
import { MangaBall } from './MangaBall/MangaBall'
import { MangaDex } from './MangaDex/MangaDex'
import { MangaDexIT } from './MangaDexIT/MangaDexIT'
import { MangaPark } from './MangaPark/MangaPark'
import { MangaParkIT } from './MangaParkIT/MangaParkIT'
import { MangaWorld } from './MangaWorld/MangaWorld'
import { NineMangaIT } from './NineMangaIT/NineMangaIT'
import { ReadAllComics } from './ReadAllComics/ReadAllComics'
import { ReadComicsOnline } from './ReadComicsOnline/ReadComicsOnline'
import { WeebCentral } from './WeebCentral/WeebCentral'
import { XoxoComic } from './XoxoComic/XoxoComic'

export const BatCaveSource = new BatCave(cheerio)
export const ComixSource = new Comix(cheerio)
export const MangaBallSource = new MangaBall(cheerio)
export const MangaDexSource = new MangaDex(cheerio)
export const MangaDexITSource = new MangaDexIT()
export const MangaParkSource = new MangaPark(cheerio)
export const MangaParkITSource = new MangaParkIT(cheerio)
export const MangaWorldSource = new MangaWorld(cheerio)
export const NineMangaITSource = new NineMangaIT(cheerio)
export const ReadAllComicsSource = new ReadAllComics(cheerio)
export const ReadComicsOnlineSource = new ReadComicsOnline(cheerio)
export const WeebCentralSource = new WeebCentral(cheerio)
export const XoxoComicSource = new XoxoComic(cheerio)
