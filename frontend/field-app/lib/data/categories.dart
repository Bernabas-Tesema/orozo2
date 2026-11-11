class OrzoCategory {
  final String id;
  final String title;
  final String titleAm;
  final String summary;
  final String asset;

  const OrzoCategory({
    required this.id,
    required this.title,
    required this.titleAm,
    required this.summary,
    required this.asset,
  });
}

/// Mirrors the folders in orozo/categories.
const List<OrzoCategory> orzoCategories = [
  OrzoCategory(
    id: 'healthcare',
    title: 'Healthcare',
    titleAm: 'ጤና',
    summary: 'Ward triage, clinics, and emergency intake. Urgent care is not delayed while an interpreter is found.',
    asset: 'assets/intro/healthcare.jpg',
  ),
  OrzoCategory(
    id: 'legal_court',
    title: 'Courts',
    titleAm: 'ፍርድ ቤት',
    summary: 'Hearings, testimony, and registry desks. Sworn interpreters are preferred for formal proceedings.',
    asset: 'assets/intro/legal_court.jpg',
  ),
  OrzoCategory(
    id: 'immigration',
    title: 'Immigration',
    titleAm: 'ስደት',
    summary: 'Reception desks, status interviews, and family reunification, including speakerphone at field sites.',
    asset: 'assets/intro/immigration.jpg',
  ),
  OrzoCategory(
    id: 'public_services',
    title: 'Public service',
    titleAm: 'ሕዝብ አገልግሎት',
    summary: 'Civil registration, municipal counters, and kebele desks where staff and residents do not share a language.',
    asset: 'assets/intro/public_services.jpg',
  ),
  OrzoCategory(
    id: 'ngo_humanitarian',
    title: 'Humanitarian',
    titleAm: 'የእርዳታ ሥራ',
    summary: 'Camp intake, protection interviews, and aid distribution. Unknown dialects go to a human coordinator.',
    asset: 'assets/intro/ngo_humanitarian.jpg',
  ),
  OrzoCategory(
    id: 'education',
    title: 'Education',
    titleAm: 'ትምህርት',
    summary: 'Enrollment, parent meetings, and classroom support when the school language is not the family language.',
    asset: 'assets/intro/education.jpg',
  ),
  OrzoCategory(
    id: 'business',
    title: 'Business',
    titleAm: 'ንግድ',
    summary: 'Contracts, banking, and commercial meetings that need a professional interpreter in the room.',
    asset: 'assets/intro/business.jpg',
  ),
];
