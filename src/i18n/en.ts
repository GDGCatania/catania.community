import type { it } from './it';

/**
 * English UI copy.
 *
 * Typed as `Record<TranslationKey, string>` against the Italian dictionary, so
 * a key added to `it.ts` and forgotten here fails the type check rather than
 * silently falling back at runtime.
 */
export const en: Record<keyof typeof it, string> = {
  // --- Site chrome ---
  'site.name': 'catania.community',
  'site.tagline': 'What the Catania tech and culture communities are up to',
  'site.skipToContent': 'Skip to content',
  'site.themeLabel': 'Site theme',
  'site.themeLight': 'Light',
  'site.themeDark': 'Dark',
  'site.sections': 'Sections',
  'site.languageLabel': 'Language',

  'nav.events': 'Events',
  'nav.communities': 'Communities',
  'nav.addCommunity': 'Add your community',

  'footer.about':
    'What the communities of Catania and its province are organising. We are a mirror: sign-ups and tickets stay on the organisers’ own platforms.',
  'footer.openFormats': 'Open formats',
  'footer.calendar': 'Calendar .ics',
  'footer.rss': 'RSS feed',
  'footer.json': 'JSON data',
  'footer.contribute': 'Contribute',
  'footer.addCommunity': 'Add a community',
  'footer.reportError': 'Report a mistake',
  'footer.sourceCode': 'Source code',
  'footer.licenses': 'Licences',
  'footer.licenseCode': 'Code',
  'footer.licenseMapsPrefix': 'Maps ©',
  'footer.licenseMapsSuffix': ' contributors',
  'footer.dataLicense': 'data ODbL 1.0',
  'footer.madeIn': 'free software, made in Catania',

  // --- Home ---
  'home.title': 'catania.community',
  'home.metaDescription':
    'Events from the communities of Catania and its province, gathered on a single page.',
  'home.metaDescriptionCount':
    '{count} upcoming events from the communities of Catania and its province: meetups, workshops and talks. Updated automatically.',
  'home.headline': 'Everything happening in Catania.',
  'home.headlineAccent': 'On one page.',
  'home.intro':
    'Events from the communities of the city and the province. We are a mirror: tickets and sign-ups stay where they already are.',
  'home.emptyNoEvents':
    'Nothing scheduled right now. The crawlers check the sources twice a day; if you are organising something,',
  'home.emptyNoEventsLink': 'tell us about it',
  'home.emptyFiltered': 'No events match the filters you picked.',
  'home.communitiesCta':
    'Who organises what, and how often. If one is missing, a name and a link are enough — we take it from there.',
  'home.communitiesLink': 'See the communities →',

  // --- Filters ---
  'filters.label': 'Filter',
  'filters.aria': 'Filter events',
  'filters.period': 'Period',
  'filters.next30': 'Next 30 days',
  'filters.where': 'Where',
  'filters.cost': 'Cost',
  'filters.freeOnly': 'Free only',
  'filters.topic': 'Topic',
  'filters.reset': 'Clear',

  // --- Event list ---
  'event.goTo': 'Go to the event',
  'event.seatsLeft': '{count} seats left',
  'event.today': 'Today',
  'event.tomorrow': 'Tomorrow',
  'event.oneEvent': '1 event',
  'event.nEvents': '{count} events',

  // --- Map and calendar ---
  'map.caption': 'OpenStreetMap',
  'map.noScript':
    'The map needs JavaScript. Every event is listed next to it anyway.',
  'map.offscreenOne': '1 event without a location on the map',
  'map.offscreenMany': '{count} events without a location on the map',
  'map.osmAttribution': '© OpenStreetMap contributors',
  'map.details': 'See details',
  'map.openIn': 'Open {name} on OpenStreetMap →',
  'calendar.aria': 'Calendar for {month}',
  'calendar.legend': 'one dot = one event that day',
  'calendar.dayAria': '{day}: {events}',
  'calendar.weekdays': 'M,T,W,T,F,S,S',

  // --- Event detail ---
  'eventPage.breadcrumb': '← All events',
  'eventPage.pastNotice':
    'This event has already taken place. We keep it online as the community’s archive.',
  'eventPage.cancelledNotice': 'This event was cancelled.',
  'eventPage.communitySince': ' · community since {year}',
  'eventPage.beginnerFriendly': 'Beginner friendly',
  'eventPage.where': 'Where',
  'eventPage.when': 'When',
  'eventPage.admission': 'Admission',
  'eventPage.registrationHint':
    'Registration happens on the community’s own site. We do not handle tickets here.',
  'eventPage.addToCalendar': 'Add to calendar',
  'eventPage.organiser': 'Organised by',
  'eventPage.seeCommunity': 'See the community →',
  'eventPage.dataSource':
    'Imported from the community’s public pages. Something off?',
  'eventPage.reportIt': 'Report it',
  'eventPage.metaFallback': '{title} — {date} in {city}. Organised by {community}.',

  // --- Communities ---
  'communities.title': '{count} communities',
  'communities.titleOne': '1 community',
  'communities.metaDescription':
    'Who runs events in Catania and its province: tech, design, culture, business and social. An open list, maintained by the communities themselves.',
  'communities.intro':
    'Who organises what, and how often. If one is missing, open a report: we usually add it within a few days.',
  'communities.addYours': 'Add yours →',
  'communities.members': '{count} members',
  'communities.next': 'next on {date}',
  'communities.noUpcoming': 'nothing scheduled',
  'communities.ctaTitle': 'Your community here',
  'communities.ctaBody':
    'A name, a link and where you publish your events. From then on we import them twice a day.',
  'communities.ctaButton': 'Submit a community',
  'communities.ctaGithub': 'On GitHub',

  'community.breadcrumb': '← All communities',
  'community.upcoming': 'Upcoming events',
  'community.past': 'Past events',
  'community.noUpcoming':
    'Nothing scheduled at the moment. We check the sources twice a day: as soon as they publish, it shows up here on its own.',
  'community.venueTbc': 'Venue to be confirmed',
  'community.cadence': 'Rhythm',
  'community.language': 'Language',
  'community.usualVenue': 'Usual venue',
  'community.membersLabel': 'Members',
  'community.since': 'Active since',
  'community.reportOnGithub': 'Report it on GitHub',
  'community.metaFallback':
    '{name}: events, rhythm and contacts. {count} events coming up in Catania.',
  'community.linkWebsite': 'Community website',

  // --- Submit form ---
  'submit.title': 'Add your community',
  'submit.metaDescription':
    'Add your community to the Catania events calendar. No GitHub account needed: a name, a link and where you publish your events.',
  'submit.intro':
    'A name, a link and where you publish your events. From then on we import them twice a day, with nothing for you to remember.',
  'submit.sectionCommunity': 'The community',
  'submit.fieldName': 'Name',
  'submit.fieldTagline': 'In one line',
  'submit.fieldTaglinePlaceholder': 'What you do, in a few words',
  'submit.fieldTopics': 'Topics',
  'submit.fieldArea': 'Where you usually meet',
  'submit.required': 'required',
  'submit.sectionEvents': 'Where you publish your events',
  'submit.eventsHelp':
    'This is the part that matters most. If you have an .ics feed or a page on gdg.community.dev, Luma, Gancio or Mobilizon, we read it automatically. Meetup and Eventbrite have closed their APIs, so those we copy by hand.',
  'submit.fieldEventsUrl': 'Main link',
  'submit.fieldIcsUrl': '.ics feed, if you have one',
  'submit.fieldContacts': 'Other contacts',
  'submit.fieldContactsPlaceholder': 'Telegram, Instagram, website…',
  'submit.sectionContact': 'So we can reach you',
  'submit.fieldContact': 'Email or handle',
  'submit.fieldContactPlaceholder': 'Only if you want a reply',
  'submit.contactHelp':
    'This ends up in a public GitHub issue along with the rest. Leave it blank if you would rather stay anonymous.',
  'submit.button': 'Send',
  'submit.buttonIssue': 'I would rather open an issue',
  'submit.noScript':
    'This form needs JavaScript. You can still open an issue on GitHub, which is exactly what the form does for you.',
  'submit.missing': 'Missing {fields}.',
  'submit.missingName': 'the name',
  'submit.missingUrl': 'the main link',
  'submit.missingTopics': 'at least one topic',
  'submit.sending': 'Sending…',
  'submit.okWithLink':
    'Done. Your report is now a public issue — the link is below.',
  'submit.ok': 'Done, thanks. Your report has been recorded.',
  'submit.openIssue': ' Open the issue →',
  'submit.failed': 'I could not send it. ',
  'submit.failedLink': 'Open the issue on GitHub with your answers already filled in →',
  'submit.nextTitle': 'What happens next',
  'submit.next1': 'Your report becomes a public issue on the repository.',
  'submit.next2': 'An automation turns it into a pull request with the file ready to go.',
  'submit.next3':
    'Once merged, the community is live and its events start arriving on their own.',
  'submit.nextHint':
    'It all happens in the open: no private moderation, the whole history is in the repository.',
  'submit.fixTitle': 'Reporting a mistake',
  'submit.fixBody':
    'Wrong date, changed venue, cancelled event: open a correction and we fix it by hand — corrections take precedence over the crawlers.',
  'submit.fixButton': 'Report a correction →',

  // --- 404 ---
  'notFound.eyebrow': 'Error 404',
  'notFound.title': 'This page is not here.',
  'notFound.body':
    'It might be an event removed at the source, or a mistyped address. Past events stay online, so if you were after something old it should still be there.',
  'notFound.toEvents': 'Go to the events',
  'notFound.toCommunities': 'See the communities',

  // --- Domain vocabulary ---
  'category.tech': 'Tech',
  'category.design': 'Design',
  'category.impresa': 'Business',
  'category.cultura': 'Culture',
  'category.sociale': 'Social',

  'area.citta': 'Catania city',
  'area.provincia': 'Province',
  'area.online': 'Online',

  'price.free': 'Free',
  'price.donation': 'Pay what you want',
  'price.paid': 'Paid',

  'status.cancelled': 'Cancelled',
  'status.online': 'Online',

  // --- Feeds ---
  'feed.calendarName': 'Catania community events',
  'feed.rssTitle': 'Catania community events',
  'feed.rssDescription':
    'Meetups, workshops and gatherings from the communities of Catania and its province.',
  'feed.organiser': 'Organised by: {name}',
  'feed.detailsAt': 'Details and registration: {url}',
  'feed.where': 'Where: {place}',
  'feed.at': '{date} at {time}',
};
