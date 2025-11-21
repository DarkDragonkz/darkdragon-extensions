"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeebCentralExtensionInfo = exports.NineMangaITExtensionInfo = exports.MangaWorldExtensionInfo = exports.WeebCentralSource = exports.NineMangaITSource = exports.MangaWorldSource = void 0;
const MangaWorld_1 = require("./MangaWorld/MangaWorld");
const NineMangaIT_1 = require("./NineMangaIT/NineMangaIT");
const WeebCentral_1 = require("./WeebCentral/WeebCentral");
const cheerio = __importStar(require("cheerio")); // Importa cheerio direttamente
// Passiamo l'oggetto cheerio importato invece di chiamare App.createCheerio() che non esiste
exports.MangaWorldSource = new MangaWorld_1.MangaWorld(cheerio);
exports.NineMangaITSource = new NineMangaIT_1.NineMangaIT(cheerio);
exports.WeebCentralSource = new WeebCentral_1.WeebCentral(cheerio);
exports.MangaWorldExtensionInfo = MangaWorld_1.MangaWorldInfo;
exports.NineMangaITExtensionInfo = NineMangaIT_1.NineMangaITInfo;
exports.WeebCentralExtensionInfo = WeebCentral_1.WeebCentralInfo;
//# sourceMappingURL=index.js.map