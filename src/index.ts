import { MangaWorld, MangaWorldInfo } from './MangaWorld/MangaWorld'
import { NineMangaIT, NineMangaITInfo } from './NineMangaIT/NineMangaIT'
import { WeebCentral, WeebCentralInfo } from './WeebCentral/WeebCentral'
import * as cheerio from 'cheerio' // Importa cheerio direttamente

// Passiamo l'oggetto cheerio importato invece di chiamare App.createCheerio() che non esiste
export const MangaWorldSource = new MangaWorld(cheerio)
export const NineMangaITSource = new NineMangaIT(cheerio)
export const WeebCentralSource = new WeebCentral(cheerio)

export const MangaWorldExtensionInfo = MangaWorldInfo
export const NineMangaITExtensionInfo = NineMangaITInfo
export const WeebCentralExtensionInfo = WeebCentralInfo