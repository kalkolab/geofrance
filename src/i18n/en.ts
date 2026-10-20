// English, the reference for every other language. {name} is filled in; a message with forms
// (one, few, many, other) picks one from {count}, following each language's plural rules.

export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

export const en = {
  loading: 'Loading GeoFrance…',
  loadError: 'Could not load map data: {error}',

  communesCount: { one: '{count} commune', other: '{count} communes' },
  departementsCount: { one: '{count} department', other: '{count} departments' },
  regionsCount: { one: '{count} region', other: '{count} regions' },
  newCommunesCount: { one: '{count} new commune', other: '{count} new communes' },
  stopsCount: { one: '{count} stop', other: '{count} stops' },
  placesCount: { one: '{count} place', other: '{count} places' },
  rowsCount: { one: '{count} row', other: '{count} rows' },

  tabMap: 'Map',
  tabStats: 'Statistics',
  tabSettings: 'Settings',
  mapLevel: 'Map level',
  departements: 'Departments',
  regions: 'Regions',
  communes: 'Communes',
  addAVisit: 'Add a visit',
  legendCommune: 'Visited commune',
  legendDepartement: 'Visited department',
  legendNone: 'Not yet',
  legendShare: 'Departments visited',
  hoverVisited: 'Visited',

  outsideFrance: 'This point is outside mainland France.',
  close: 'Close',
  cancel: 'Cancel',
  departementCode: 'Department {code}',
  notVisited: 'Not visited yet.',
  firstVisitedOn: 'First visited on {date}.',
  visitedNoDate: 'Visited, date unknown.',
  communesInDep: { one: '{visited} of {count} commune visited in {dep}.', other: '{visited} of {count} communes visited in {dep}.' },
  remove: 'Remove',
  markVisited: 'Mark as visited',
  confirmRemove: 'Remove your visit to {name}? If you sync with Google Drive, it is removed on your other devices too.',

  change: 'Change',
  searchPlaceholder: 'City name or postcode',
  searchLabel: 'Search a commune',
  dateOptional: 'Date (optional)',
  clear: 'Clear',
  noteOptional: 'Note (optional)',
  alreadyEarlier: '{name} already has an earlier visit, which is kept. Only the first visit to each commune is stored.',
  saveVisit: 'Save visit',

  byRegion: 'By region',
  byRegionHelp: "Share of each region's departments you have visited.",
  regionDeps: '{visited}/{total} departments',
  yourVisits: 'Your visits',
  noVisits: 'No visits yet. Tap the map or use "Add a visit" to record one.',
  dateUnknown: 'Date unknown',
  sourceManual: 'Manual',
  sourceCsv: 'CSV import',
  sourceTimeline: 'Timeline',
  sourcePhoto: 'Photo',
  delete: 'Delete',
  deleteVisitTo: 'Delete visit to {name}',
  showAll: { one: 'Show all {count} visit', other: 'Show all {count} visits' },

  language: 'Language',
  yourData: 'Your data',
  yourDataHelp: {
    one: 'Your {count} visit is stored in this browser, and in your Google Drive if you sign in. Export it to keep a copy of your own.',
    other: 'Your {count} visits are stored in this browser, and in your Google Drive if you sign in. Export them to keep a copy of your own.',
  },
  exportVisits: 'Export visits',
  importVisits: 'Import visits',
  deleteAll: 'Delete all',
  imported: { one: 'Imported {count} visit.', other: 'Imported {count} visits.' },
  confirmDeleteAll: {
    one: 'Delete your {count} visit? If you sync with Google Drive, it is removed on your other devices too.',
    other: 'Delete all {count} visits? If you sync with Google Drive, they are removed on your other devices too.',
  },
  allDeleted: 'All visits deleted.',
  comingNext: 'Coming next',
  comingNextBody: 'Google Photos import.',
  about: 'About',
  aboutBody:
    'Mainland France including Corsica: 13 regions, 96 departments and about 34,750 communes. Codes and names from INSEE (COG), boundaries from IGN ADMIN EXPRESS via france-geojson, under the Licence Ouverte.',

  googleAccount: 'Google account',
  signInNotConfigured: 'Google sign-in is not set up for this copy of the app.',
  signInHelp:
    'Sign in to keep your visits in your own Google Drive and see the same data on your phone and computer. The app can only see its own file there, not the rest of your Drive.',
  signIn: 'Sign in with Google',
  signedInAs: 'Signed in as **{email}**.',
  syncing: 'Syncing…',
  tapSync: 'Tap Sync to bring in changes from your other devices.',
  lastSynced: 'Last synced at {time}.',
  syncNow: 'Sync now',
  signOut: 'Sign out',
  syncButton: 'Sync',
  synced: 'Synced',
  syncFailed: 'Sync failed',
  driveAccount: 'Google Drive: {email}',

  timelineTitle: 'Import Google Maps Timeline',
  timelineHelp:
    'On your Android phone, open the Settings app, then Location, Location services, Timeline, and **Export Timeline data**. On some phones it is instead in Google Maps: your profile picture, Your Timeline, the ⋮ menu, Location and privacy settings. On an iPhone, it is in Google Maps under Settings, Personal content, **Export Timeline data**. Choose the saved file here. Older Google Takeout Location History exports (.zip, or the .json files inside) work too. Only places where you stopped are counted, and only the first visit to each commune is kept.',
  timelineChoose: 'Choose Timeline file',
  timelineReading: 'Reading your Timeline…',
  timelineChecking: 'Checking {stops}… {done} done',
  timelineAdded: 'Added {communes}.',
  timelineAddedEarlier: 'Added {communes} and an earlier first visit for {earlier}.',
  timelineFound: '{stops} found.',
  timelineFoundRange: '{stops} found from {from} to {to}.',
  timelineToAdd: '{communes} to add.',
  timelineToAddEarlier: '{communes} to add, and {earlier} you visited earlier than recorded.',
  timelineOnlyFirst: 'Only the first visit to each commune is kept.',
  timelineOutside: '{stops} outside mainland France, skipped',
  timelineDuplicates: '{stops} in communes already counted, skipped',
  addCommunes: { one: 'Add {count} commune', other: 'Add {count} communes' },

  csvTitle: 'Import places from a CSV file',
  csvHelp:
    'A file with a header row and `lat` and `lon` columns, separated by semicolons or commas. Each point in mainland France marks its commune as visited (date unknown). If there is a `been` column, only rows marked "been" are used.',
  csvChoose: 'Choose CSV file',
  csvChecking: 'Checking {places}…',
  csvAdded: 'Added {communes} to your visits.',
  csvRead: '**{file}**: {places} read, {communes} to add.',
  csvOutside: '{places} outside mainland France, skipped',
  csvAlready: '{communes} already in your visits, skipped',
  csvNotBeen: '{rows} not marked "been", skipped',
  csvInvalid: '{rows} without valid coordinates (line {lines})',

  errSyncFile: 'The file in Google Drive is not a GeoFrance sync file',
  errNotExportCsv: 'This is not a GeoFrance export file. For a CSV of places, use "{csv}" below.',
  errNotExport: 'Not a GeoFrance export file',
  errLoad: 'Could not load {path} ({status})',
  errNotTimeline: 'This is not a Google Maps Timeline file',
  errCsvHeader: 'The CSV needs a header row with "lat" and "lon" columns',
  errNotJson: '{file}: not a JSON file',
  errNoTimeline: 'No Google Maps Timeline data found in the selected files',
  errCheckPlaces: 'Could not check the places',
  errGoogleLoad: 'Could not load Google sign-in. Check your connection.',
  errGoogleNotConfigured: 'Google sign-in is not configured for this site',
  errGoogleLoading: 'Google sign-in is still loading, try again in a moment',
  errSignInCancelled: 'Sign-in was cancelled',
  errSignInExpired: 'Google sign-in expired',
  errDrive: 'Google Drive error {status}',
} satisfies Record<string, string | Plural>

export type Messages = { [K in keyof typeof en]: string | Plural }
