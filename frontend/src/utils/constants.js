export const languages = [
  'Assamese', 'Bengali', 'English', 'Gujarati', 'Hindi', 'Kannada',
  'Malayalam', 'Marathi', 'Odia', 'Punjabi', 'Sanskrit', 'Tamil', 'Telugu', 'Urdu',
]

export const domainSubjects = [
  'Accountancy / Book Keeping', 'Agriculture', 'Anthropology',
  'Biology / Biological Studies / Biotechnology / Biochemistry', 'Business Studies',
  'Chemistry', 'Computer Science / Information Practices', 'Economics / Business Economics',
  'Environmental Studies / Environmental Science', 'Fine Arts / Visual Arts / Commercial Arts',
  'Geography / Geology', 'History', 'Home Science', 'Knowledge Tradition - Practices in India',
  'Mass Media / Mass Communication', 'Mathematics / Applied Mathematics',
  'Performing Arts (Dance, Drama, Music)', 'Physical Education (Yoga, Sports)',
  'Physics', 'Political Science', 'Psychology', 'Sociology',
]

export const generalTests = ['General Aptitude Test']

export const categoryToCutoffKey = {
  GEN: 'UR', OBC: 'OBC', EWS: 'EWS', SC: 'SC', ST: 'ST', PWD: 'PwBD',
}

export const northCampusColleges = new Set([
  "St. Stephen's College", 'Shri Ram College of Commerce', 'Hindu College',
  'Hansraj College', 'Miranda House', 'Kirori Mal College', 'Ramjas College',
  'Daulat Ram College', 'Sri Guru Tegh Bahadur Khalsa College',
])

export const initialForm = {
  name: '', gender: '', category: '', stream: '',
  displayMode: 'college-first', campusPreference: 'both',
}

export const initialSubjects = Array.from({ length: 5 }, (_, index) => ({
  subject: '', marks: '', label: `Subject ${index + 1}${index === 0 ? '*' : ''}`,
}))
