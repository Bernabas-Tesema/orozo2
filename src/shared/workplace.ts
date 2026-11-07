import healthcare from '../assets/images/triage_clinical_station_hero_1793945653740.jpg';
import legalCourt from '../assets/images/legal_court.jpg';
import immigration from '../assets/images/immigration.jpg';
import ngoHumanitarian from '../assets/images/ngo_humanitarian.jpg';
import publicServices from '../assets/images/public_services.jpg';
import education from '../assets/images/education.jpg';
import business from '../assets/images/business.jpg';
import { ServiceCategory } from './types';

const IMAGES: Record<ServiceCategory, string> = {
  healthcare,
  legal_court: legalCourt,
  immigration,
  ngo_humanitarian: ngoHumanitarian,
  public_services: publicServices,
  education,
  business,
};

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

export function workplaceOf(user: { organizationName?: string; workplace?: ServiceCategory }): ServiceCategory {
  return user.workplace || workplaceFromName(user.organizationName || '');
}

export function workplaceImage(workplace: ServiceCategory): string {
  return IMAGES[workplace];
}

export function workplaceContext(workplace: ServiceCategory): string {
  if (workplace === 'legal_court') return 'Hearing in the courtroom';
  if (workplace === 'immigration') return 'Applicant at the immigration desk';
  if (workplace === 'ngo_humanitarian') return 'Client at the field desk';
  if (workplace === 'education') return 'Student or parent at the school desk';
  if (workplace === 'business') return 'Customer at the service counter';
  if (workplace === 'public_services') return 'Resident at the public desk';
  return 'Patient in ER Bay 2 with acute symptoms';
}

export function workplaceLanguageLabel(workplace: ServiceCategory): string {
  if (workplace === 'healthcare') return 'Patient Language';
  if (workplace === 'legal_court') return 'Party Language';
  if (workplace === 'immigration') return 'Applicant Language';
  return 'Speaker Language';
}
