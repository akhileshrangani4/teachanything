/**
 * Safe educational TLDs that are allowed (specific to educational institutions).
 * These bypass the broad TLD check because they're restricted to academia.
 *
 * Stored in canonical form (without leading dot). Input is normalized before checking.
 * Organized by region for maintainability.
 */
export const SAFE_EDUCATIONAL_TLDS = [
  // North America
  "edu", // US education (most common)
  "edu.ca", // Canada education
  "edu.mx", // Mexico education

  // Central & South America
  "edu.ar", // Argentina education
  "edu.br", // Brazil education
  "edu.cl", // Chile education
  "edu.co", // Colombia education
  "edu.pe", // Peru education
  "edu.ve", // Venezuela education
  "edu.uy", // Uruguay education
  "edu.py", // Paraguay education
  "edu.bo", // Bolivia education
  "edu.ec", // Ecuador education
  "ac.cr", // Costa Rica academia
  "ac.pa", // Panama academia
  "edu.cu", // Cuba education
  "edu.do", // Dominican Republic education
  "edu.hn", // Honduras education
  "edu.gt", // Guatemala education
  "edu.sv", // El Salvador education
  "edu.ni", // Nicaragua education

  // Caribbean
  "edu.jm", // Jamaica education
  "edu.tt", // Trinidad and Tobago education
  "edu.bb", // Barbados education
  "edu.bs", // Bahamas education

  // Europe - Western
  "ac.uk", // UK academia
  "edu.ie", // Ireland education
  "edu.fr", // France education
  "univ.fr", // France universities
  "edu.de", // Germany education
  "uni.de", // Germany universities
  "edu.nl", // Netherlands education
  "edu.be", // Belgium education
  "edu.lu", // Luxembourg education
  "edu.ch", // Switzerland education
  "edu.at", // Austria education
  "ac.at", // Austria academia

  // Europe - Southern
  "edu.es", // Spain education
  "edu.pt", // Portugal education
  "edu.it", // Italy education
  "edu.gr", // Greece education
  "edu.mt", // Malta education
  "edu.cy", // Cyprus education
  "edu.sm", // San Marino education
  "edu.va", // Vatican City education
  "edu.ad", // Andorra education
  "edu.mc", // Monaco education

  // Europe - Northern
  "edu.se", // Sweden education
  "edu.no", // Norway education
  "edu.dk", // Denmark education
  "edu.fi", // Finland education
  "edu.is", // Iceland education
  "edu.fo", // Faroe Islands education
  "edu.gl", // Greenland education

  // Europe - Eastern
  "edu.pl", // Poland education
  "edu.cz", // Czech Republic education
  "edu.sk", // Slovakia education
  "edu.hu", // Hungary education
  "edu.ro", // Romania education
  "edu.bg", // Bulgaria education
  "edu.hr", // Croatia education
  "edu.si", // Slovenia education
  "edu.rs", // Serbia education
  "edu.ba", // Bosnia and Herzegovina education
  "edu.mk", // North Macedonia education
  "edu.me", // Montenegro education
  "edu.al", // Albania education
  "edu.ee", // Estonia education
  "edu.lv", // Latvia education
  "edu.lt", // Lithuania education
  "edu.by", // Belarus education
  "edu.ua", // Ukraine education
  "edu.md", // Moldova education
  "edu.ru", // Russia education

  // Middle East
  "ac.il", // Israel academia
  "edu.sa", // Saudi Arabia education
  "ac.ae", // UAE academia
  "edu.jo", // Jordan education
  "edu.lb", // Lebanon education
  "edu.kw", // Kuwait education
  "edu.qa", // Qatar education
  "edu.bh", // Bahrain education
  "edu.om", // Oman education
  "edu.ye", // Yemen education
  "edu.iq", // Iraq education
  "edu.sy", // Syria education
  "edu.ps", // Palestine education
  "edu.tr", // Turkey education

  // Asia - East
  "edu.cn", // China education
  "ac.cn", // China academia
  "ac.jp", // Japan academia
  "edu.jp", // Japan education
  "ac.kr", // South Korea academia
  "edu.kr", // South Korea education
  "edu.tw", // Taiwan education
  "edu.hk", // Hong Kong education
  "edu.mo", // Macao education
  "edu.mn", // Mongolia education
  "edu.kp", // North Korea education

  // Asia - Southeast
  "edu.sg", // Singapore education
  "edu.my", // Malaysia education
  "ac.id", // Indonesia academia
  "ac.th", // Thailand academia
  "edu.th", // Thailand education
  "edu.vn", // Vietnam education
  "edu.ph", // Philippines education
  "edu.kh", // Cambodia education
  "edu.la", // Laos education
  "edu.mm", // Myanmar education
  "edu.bn", // Brunei education
  "edu.tl", // Timor-Leste education

  // Asia - South
  "edu.in", // India education
  "ac.in", // India academia
  "edu.pk", // Pakistan education
  "edu.bd", // Bangladesh education
  "ac.lk", // Sri Lanka academia
  "edu.lk", // Sri Lanka education
  "edu.np", // Nepal education
  "edu.bt", // Bhutan education
  "edu.mv", // Maldives education
  "edu.af", // Afghanistan education

  // Asia - Central
  "edu.kz", // Kazakhstan education
  "edu.uz", // Uzbekistan education
  "edu.tm", // Turkmenistan education
  "edu.tj", // Tajikistan education
  "edu.kg", // Kyrgyzstan education

  // Africa - North
  "edu.eg", // Egypt education
  "edu.dz", // Algeria education
  "ac.ma", // Morocco academia
  "rnu.tn", // Tunisia education
  "edu.ly", // Libya education
  "edu.sd", // Sudan education

  // Africa - West
  "edu.ng", // Nigeria education
  "edu.gh", // Ghana education
  "edu.sn", // Senegal education
  "edu.ml", // Mali education
  "edu.ne", // Niger education
  "edu.bf", // Burkina Faso education
  "edu.ci", // Côte d'Ivoire education
  "edu.gn", // Guinea education
  "edu.sl", // Sierra Leone education
  "edu.lr", // Liberia education
  "edu.tg", // Togo education
  "edu.bj", // Benin education

  // Africa - East
  "ac.ke", // Kenya academia
  "ac.tz", // Tanzania academia
  "ac.ug", // Uganda academia
  "edu.et", // Ethiopia education
  "edu.so", // Somalia education
  "edu.rw", // Rwanda education
  "edu.bi", // Burundi education
  "edu.dj", // Djibouti education
  "edu.er", // Eritrea education

  // Africa - Southern
  "ac.za", // South Africa academia
  "ac.zw", // Zimbabwe academia
  "edu.bw", // Botswana education
  "edu.mw", // Malawi education
  "edu.zm", // Zambia education
  "edu.mz", // Mozambique education
  "edu.na", // Namibia education
  "edu.ls", // Lesotho education
  "edu.sz", // Eswatini education

  // Africa - Central
  "edu.cm", // Cameroon education
  "edu.ga", // Gabon education
  "edu.cg", // Congo education
  "edu.cd", // DR Congo education
  "edu.cf", // Central African Republic education
  "edu.td", // Chad education

  // Oceania
  "edu.au", // Australia education
  "ac.nz", // New Zealand academia
  "edu.nz", // New Zealand education
  "ac.fj", // Fiji academia
  "ac.pg", // Papua New Guinea academia
  "edu.nc", // New Caledonia education
  "edu.vu", // Vanuatu education
  "edu.ws", // Samoa education
  "edu.to", // Tonga education
  "edu.sb", // Solomon Islands education
  "edu.ki", // Kiribati education
  "edu.mh", // Marshall Islands education
  "edu.fm", // Micronesia education
  "edu.pw", // Palau education
  "edu.nr", // Nauru education
  "edu.tv", // Tuvalu education
  "edu.ck", // Cook Islands education
  "edu.nu", // Niue education
  "edu.gu", // Guam education
  "edu.mp", // Northern Mariana Islands education
  "edu.as", // American Samoa education
  "edu.pr", // Puerto Rico education
  "edu.vi", // U.S. Virgin Islands education
];

/**
 * Commercial TLDs blocked as broad patterns only.
 * Specific domains (gmail.com, vercel.ai) are still allowed.
 */
export const BLOCKED_GENERIC_TLDS = [
  "com",
  "net",
  "org",
  "biz",
  "info",
  "name",
  "pro",
  "xyz",
  "online",
  "site",
  "tech",
  "store",
  "app",
  "dev",
  "io",
  "ai",
  "co", // Too generic (used by many countries)
];
