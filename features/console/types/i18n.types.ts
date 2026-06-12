import type en from '../locales/en.json';

/** Strongly-typed `console` namespace of the feature dictionary. */
export type ConsoleDictionary = (typeof en)['console'];
export type ConsoleCommonDictionary = ConsoleDictionary['common'];
