/* Entry for the vendored document engine bundle (built by tools/build-vendor.mjs into vendor/docs.js).
   Everything the app needs to read, inspect, fill and preview .docx files, in one self-hosted ES module:
   no runtime CDN requests, which is part of Clausery's privacy guarantee. */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import InspectModule from 'docxtemplater/js/inspect-module.js';
import JSZip from 'jszip';
import { renderAsync } from 'docx-preview';

export { PizZip, Docxtemplater, InspectModule, JSZip, renderAsync };
