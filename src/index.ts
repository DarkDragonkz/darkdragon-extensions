import { MangaWorld, MangaWorldInfo } from './MangaWorld/MangaWorld'
import { NineMangaIT, NineMangaITInfo } from './NineMangaIT/NineMangaIT'
import { WeebCentral, WeebCentralInfo } from './WeebCentral/WeebCentral'
import { MangaDex, MangaDexInfo } from './MangaDex/MangaDex'
// Importa la nuova estensione
import { MangaParkIT, MangaParkITInfo } from './MangaParkIT/MangaParkIT'

import * as cheerio from 'cheerio'

export const MangaWorldSource = new MangaWorld(cheerio)
export const NineMangaITSource = new NineMangaIT(cheerio)
export const WeebCentralSource = new WeebCentral(cheerio)
export const MangaDexSource = new MangaDex(cheerio)
// Esporta la nuova estensione
export const MangaParkITSource = new MangaParkIT(cheerio)

export const MangaWorldExtensionInfo = MangaWorldInfo
export const NineMangaITExtensionInfo = NineMangaITInfo
export const WeebCentralExtensionInfo = WeebCentralInfo
export const MangaDexExtensionInfo = MangaDexInfo
// Esporta le info
export const MangaParkITExtensionInfo = MangaParkITInfo