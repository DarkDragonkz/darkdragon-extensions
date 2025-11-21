import { MangaWorld, MangaWorldInfo } from './MangaWorld/MangaWorld'
import { NineMangaIT, NineMangaITInfo } from './NineMangaIT/NineMangaIT'
import { WeebCentral, WeebCentralInfo } from './WeebCentral/WeebCentral'

export const MangaWorldSource = new MangaWorld(App.createCheerio())
export const NineMangaITSource = new NineMangaIT(App.createCheerio())
export const WeebCentralSource = new WeebCentral(App.createCheerio())

export const MangaWorldExtensionInfo = MangaWorldInfo
export const NineMangaITExtensionInfo = NineMangaITInfo
export const WeebCentralExtensionInfo = WeebCentralInfo