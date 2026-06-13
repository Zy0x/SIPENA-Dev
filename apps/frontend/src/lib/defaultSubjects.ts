export interface DefaultSubjectGroup {
  id: "sd" | "smp" | "sma";
  label: string;
  subjects: string[];
}

export const DEFAULT_SUBJECT_GROUPS: DefaultSubjectGroup[] = [
  {
    id: "sd",
    label: "SD / MI",
    subjects: [
      "Bahasa Indonesia",
      "Matematika",
      "IPAS",
      "Pendidikan Pancasila",
      "Pendidikan Agama dan Budi Pekerti",
      "Bahasa Inggris",
      "Seni Budaya",
      "PJOK",
      "Muatan Lokal",
      "Bahasa Daerah",
    ],
  },
  {
    id: "smp",
    label: "SMP / MTs",
    subjects: [
      "Bahasa Indonesia",
      "Matematika",
      "IPA",
      "IPS",
      "Bahasa Inggris",
      "Pendidikan Pancasila",
      "Pendidikan Agama dan Budi Pekerti",
      "Informatika",
      "Seni Budaya",
      "Prakarya",
      "PJOK",
      "Bahasa Daerah",
    ],
  },
  {
    id: "sma",
    label: "SMA / MA",
    subjects: [
      "Bahasa Indonesia",
      "Matematika Wajib",
      "Matematika Tingkat Lanjut",
      "Bahasa Inggris",
      "Pendidikan Pancasila",
      "Pendidikan Agama dan Budi Pekerti",
      "Biologi",
      "Fisika",
      "Kimia",
      "Informatika",
      "Ekonomi",
      "Geografi",
      "Sosiologi",
      "Sejarah",
      "Antropologi",
      "Bahasa Indonesia Tingkat Lanjut",
      "Bahasa Inggris Tingkat Lanjut",
      "Bahasa Asing",
      "Seni Budaya",
      "Prakarya dan Kewirausahaan",
      "PJOK",
    ],
  },
];

export const DEFAULT_SUBJECTS = Array.from(
  new Set(DEFAULT_SUBJECT_GROUPS.flatMap((group) => group.subjects)),
);
