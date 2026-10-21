import type en from '../locales/en.json';
import type security from '../locales/accountSecurity.en.json';

/** Strongly-typed `console` namespace of the feature dictionary (the account-security labels live in their own file). */
export type ConsoleDictionary = (typeof en)['console'] & (typeof security)['console'];
export type ConsoleCommonDictionary = ConsoleDictionary['common'];
