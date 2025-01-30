type ValidationResult = {
  isValid: boolean;
  remarks: string[];
  details: Record<string, string[]>;
};

const COUNTRY_CODES = new Set([
  // ISO 3166-1 alpha-3 country codes
  'AFG', // Afghanistan
  'ALB', // Albania
  'DZA', // Algeria
  'ASM', // American Samoa
  'AND', // Andorra
  'AGO', // Angola
  'AIA', // Anguilla
  'ATA', // Antarctica
  'ATG', // Antigua and Barbuda
  'ARG', // Argentina
  'ARM', // Armenia
  'ABW', // Aruba
  'AUS', // Australia
  'AUT', // Austria
  'AZE', // Azerbaijan
  'BHS', // Bahamas
  'BHR', // Bahrain
  'BGD', // Bangladesh
  'BRB', // Barbados
  'BLR', // Belarus
  'BEL', // Belgium
  'BLZ', // Belize
  'BEN', // Benin
  'BMU', // Bermuda
  'BTN', // Bhutan
  'BOL', // Bolivia
  'BES', // Bonaire, Sint Eustatius and Saba
  'BIH', // Bosnia and Herzegovina
  'BWA', // Botswana
  'BVT', // Bouvet Island
  'BRA', // Brazil
  'IOT', // British Indian Ocean Territory
  'BRN', // Brunei Darussalam
  'BGR', // Bulgaria
  'BFA', // Burkina Faso
  'BDI', // Burundi
  'CPV', // Cabo Verde
  'KHM', // Cambodia
  'CMR', // Cameroon
  'CAN', // Canada
  'CYM', // Cayman Islands
  'CAF', // Central African Republic
  'TCD', // Chad
  'CHL', // Chile
  'CHN', // China
  'CXR', // Christmas Island
  'CCK', // Cocos (Keeling) Islands
  'COL', // Colombia
  'COM', // Comoros
  'COG', // Congo
  'COD', // Congo (Democratic Republic)
  'COK', // Cook Islands
  'CRI', // Costa Rica
  'CIV', // Côte d'Ivoire
  'HRV', // Croatia
  'CUB', // Cuba
  'CUW', // Curaçao
  'CYP', // Cyprus
  'CZE', // Czech Republic
  'DNK', // Denmark
  'DJI', // Djibouti
  'DMA', // Dominica
  'DOM', // Dominican Republic
  'ECU', // Ecuador
  'EGY', // Egypt
  'SLV', // El Salvador
  'GNQ', // Equatorial Guinea
  'ERI', // Eritrea
  'EST', // Estonia
  'SWZ', // Eswatini
  'ETH', // Ethiopia
  'FLK', // Falkland Islands
  'FRO', // Faroe Islands
  'FJI', // Fiji
  'FIN', // Finland
  'FRA', // France
  'GUF', // French Guiana
  'PYF', // French Polynesia
  'ATF', // French Southern Territories
  'GAB', // Gabon
  'GMB', // Gambia
  'GEO', // Georgia
  'DEU', // Germany
  'GHA', // Ghana
  'GIB', // Gibraltar
  'GRC', // Greece
  'GRL', // Greenland
  'GRD', // Grenada
  'GLP', // Guadeloupe
  'GUM', // Guam
  'GTM', // Guatemala
  'GGY', // Guernsey
  'GIN', // Guinea
  'GNB', // Guinea-Bissau
  'GUY', // Guyana
  'HTI', // Haiti
  'HMD', // Heard Island and McDonald Islands
  'VAT', // Holy See
  'HND', // Honduras
  'HKG', // Hong Kong
  'HUN', // Hungary
  'ISL', // Iceland
  'IND', // India
  'IDN', // Indonesia
  'IRN', // Iran
  'IRQ', // Iraq
  'IRL', // Ireland
  'IMN', // Isle of Man
  'ISR', // Israel
  'ITA', // Italy
  'JAM', // Jamaica
  'JPN', // Japan
  'JEY', // Jersey
  'JOR', // Jordan
  'KAZ', // Kazakhstan
  'KEN', // Kenya
  'KIR', // Kiribati
  'PRK', // North Korea
  'KOR', // South Korea
  'KWT', // Kuwait
  'KGZ', // Kyrgyzstan
  'LAO', // Laos
  'LVA', // Latvia
  'LBN', // Lebanon
  'LSO', // Lesotho
  'LBR', // Liberia
  'LBY', // Libya
  'LIE', // Liechtenstein
  'LTU', // Lithuania
  'LUX', // Luxembourg
  'MAC', // Macao
  'MDG', // Madagascar
  'MWI', // Malawi
  'MYS', // Malaysia
  'MDV', // Maldives
  'MLI', // Mali
  'MLT', // Malta
  'MHL', // Marshall Islands
  'MTQ', // Martinique
  'MRT', // Mauritania
  'MUS', // Mauritius
  'MYT', // Mayotte
  'MEX', // Mexico
  'FSM', // Micronesia
  'MDA', // Moldova
  'MCO', // Monaco
  'MNG', // Mongolia
  'MNE', // Montenegro
  'MSR', // Montserrat
  'MAR', // Morocco
  'MOZ', // Mozambique
  'MMR', // Myanmar
  'NAM', // Namibia
  'NRU', // Nauru
  'NPL', // Nepal
  'NLD', // Netherlands
  'NCL', // New Caledonia
  'NZL', // New Zealand
  'NIC', // Nicaragua
  'NER', // Niger
  'NGA', // Nigeria
  'NIU', // Niue
  'NFK', // Norfolk Island
  'MKD', // North Macedonia
  'MNP', // Northern Mariana Islands
  'NOR', // Norway
  'OMN', // Oman
  'PAK', // Pakistan
  'PLW', // Palau
  'PSE', // Palestine
  'PAN', // Panama
  'PNG', // Papua New Guinea
  'PRY', // Paraguay
  'PER', // Peru
  'PHL', // Philippines
  'PCN', // Pitcairn
  'POL', // Poland
  'PRT', // Portugal
  'PRI', // Puerto Rico
  'QAT', // Qatar
  'REU', // Réunion
  'ROU', // Romania
  'RUS', // Russia
  'RWA', // Rwanda
  'BLM', // Saint Barthélemy
  'SHN', // Saint Helena, Ascension and Tristan da Cunha
  'KNA', // Saint Kitts and Nevis
  'LCA', // Saint Lucia
  'MAF', // Saint Martin (French part)
  'SPM', // Saint Pierre and Miquelon
  'VCT', // Saint Vincent and the Grenadines
  'WSM', // Samoa
  'SMR', // San Marino
  'STP', // Sao Tome and Principe
  'SAU', // Saudi Arabia
  'SEN', // Senegal
  'SRB', // Serbia
  'SYC', // Seychelles
  'SLE', // Sierra Leone
  'SGP', // Singapore
  'SXM', // Sint Maarten (Dutch part)
  'SVK', // Slovakia
  'SVN', // Slovenia
  'SLB', // Solomon Islands
  'SOM', // Somalia
  'ZAF', // South Africa
  'SGS', // South Georgia and the South Sandwich Islands
  'SSD', // South Sudan
  'ESP', // Spain
  'LKA', // Sri Lanka
  'SDN', // Sudan
  'SUR', // Suriname
  'SJM', // Svalbard and Jan Mayen
  'SWE', // Sweden
  'CHE', // Switzerland
  'SYR', // Syria
  'TWN', // Taiwan
  'TJK', // Tajikistan
  'TZA', // Tanzania
  'THA', // Thailand
  'TLS', // Timor-Leste
  'TGO', // Togo
  'TKL', // Tokelau
  'TON', // Tonga
  'TTO', // Trinidad and Tobago
  'TUN', // Tunisia
  'TUR', // Turkey
  'TKM', // Turkmenistan
  'TCA', // Turks and Caicos Islands
  'TUV', // Tuvalu
  'UGA', // Uganda
  'UKR', // Ukraine
  'ARE', // United Arab Emirates
  'GBR', // United Kingdom
  'USA', // United States
  'UMI', // United States Minor Outlying Islands
  'URY', // Uruguay
  'UZB', // Uzbekistan
  'VUT', // Vanuatu
  'VEN', // Venezuela
  'VNM', // Vietnam
  'VGB', // Virgin Islands (British)
  'VIR', // Virgin Islands (U.S.)
  'WLF', // Wallis and Futuna
  'ESH', // Western Sahara
  'YEM', // Yemen
  'ZMB', // Zambia
  'ZWE', // Zimbabwe
]);

export function validatePassportData(data: Record<string, any>): ValidationResult {
  const remarks: string[] = [];
  const details: Record<string, string[]> = {};

  // Helper function to add validation messages
  const addValidation = (field: string, message: string) => {
    if (!details[field]) details[field] = [];
    details[field].push(message);
    remarks.push(`${field}: ${message}`);
  };

  // 1. Passport Number Validation
  const passportNumber = data.passportNumber?.trim() || '';
  if (!passportNumber) {
    addValidation('passportNumber', 'Missing passport number');
  } else {
    if (passportNumber.length < 8 || passportNumber.length > 9) {
      addValidation('passportNumber', `Invalid length (${passportNumber.length} characters)`);
    }
    if (!/^[A-Z0-9<]+$/.test(passportNumber)) {
      addValidation('passportNumber', 'Contains invalid characters');
    }
  }

  // 2. Date Validation
  const validateDate = (field: string, value: any, options?: {
    minYear?: number;
    maxYear?: number;
    notFuture?: boolean;
    notPast?: boolean;
  }) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      addValidation(field, 'Invalid date format');
      return null;
    }

    const year = date.getUTCFullYear();
    const currentYear = new Date().getUTCFullYear();

    if (options?.minYear && year < options.minYear) {
      addValidation(field, `Year cannot be before ${options.minYear}`);
    }
    if (options?.maxYear && year > options.maxYear) {
      addValidation(field, `Year cannot be after ${options.maxYear}`);
    }
    if (options?.notFuture && date > new Date()) {
      addValidation(field, 'Cannot be in the future');
    }
    if (options?.notPast && date < new Date()) {
      addValidation(field, 'Cannot be in the past');
    }

    return date;
  };

  // Date-specific rules
  const dob = validateDate('dateOfBirth', data.dateOfBirth, {
    minYear: 1900,
    maxYear: new Date().getUTCFullYear() - 1,
    notFuture: true
  });

  const doi = validateDate('dateOfIssue', data.dateOfIssue, {
    minYear: 2000,
    notFuture: true
  });

  const doe = validateDate('dateOfExpiry', data.dateOfExpiry, {
    minYear: new Date().getUTCFullYear(),
    notPast: true
  });

  // Date consistency checks
  if (doi && doe && doi > doe) {
    addValidation('dateOfIssue', 'Cannot be after expiration date');
  }
  if (dob && doi && dob > doi) {
    addValidation('dateOfBirth', 'Cannot be after issue date');
  }

  // 3. Nationality Validation
  const nationality = (data.nationality || '').toUpperCase();
  if (!COUNTRY_CODES.has(nationality)) {
    addValidation('nationality', 'Invalid country code');
  }

  // 4. Confidence Score Validation
  if (data.confidence_scores) {
    Object.entries(data.confidence_scores).forEach(([field, score]) => {
      if (typeof score !== 'number' || score < 0 || score > 1) {
        addValidation(`confidence_scores.${field}`, 'Invalid confidence score');
      }
    });
  }

  // 5. Field Presence Validation
  const requiredFields = [
    'fullName', 'dateOfBirth', 'passportNumber',
    'nationality', 'dateOfIssue', 'dateOfExpiry'
  ];

  requiredFields.forEach(field => {
    if (!data[field]?.toString().trim()) {
      addValidation(field, 'Required field missing');
    }
  });

  // 6. Name Validation
  const fullName = (data.fullName || '').trim();
  if (fullName) {
    if (!/\s/.test(fullName)) {
      addValidation('fullName', 'Missing surname/given name separator');
    }
    if (!/^[\p{L} \-'.]+$/u.test(fullName)) {
      addValidation('fullName', 'Contains invalid characters');
    }
  }

  return {
    isValid: remarks.length === 0,
    remarks,
    details
  };
}