import { ServiceCategory } from './types';

const WORKPLACES: ServiceCategory[] = [
  'healthcare',
  'legal_court',
  'immigration',
  'ngo_humanitarian',
  'public_services',
  'education',
  'business',
];

export function isWorkplace(value: string): value is ServiceCategory {
  return WORKPLACES.includes(value as ServiceCategory);
}

export function workplaceFromName(organizationName: string): ServiceCategory {
  const name = organizationName.toLowerCase();
  if (/(court|judicial|\bbench\b|ፍርድ)/.test(name)) return 'legal_court';
  if (/(immigrat|refugee|unhcr|asylum|dollo|gambella)/.test(name)) return 'immigration';
  if (/(\bngo\b|humanitarian|charit|unicef|red cross)/.test(name)) return 'ngo_humanitarian';
  if (/(school|universit|college|education)/.test(name)) return 'education';
  if (/(\bbank\b|business|company|enterprise)/.test(name)) return 'business';
  if (/(public service|municip|kebele|woreda|bureau)/.test(name)) return 'public_services';
  return 'healthcare';
}
