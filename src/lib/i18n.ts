export type Language = 'ha' | 'en';

export interface Translations {
  appName: string;
  // Auth
  createAccount: string;
  welcomeBack: string;
  authSignUpSubtitle: string;
  authSignInSubtitle: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  registerBtn: string;
  loginBtn: string;
  continueWithGoogle: string;
  orDivider: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  errMissingEmailPass: string;
  errMissingName: string;
  errPasswordMismatch: string;
  verifyEmailTitle: string;
  verifyEmailBodyPrefix: string;
  verifyEmailBodySuffix: string;
  verifyContinueBtn: string;
  checking: string;
  resendVerificationBtn: string;
  useAnotherAccount: string;
  authMethodEmail: string;
  authMethodPhone: string;
  countryCodeLabel: string;
  phoneNumberLabel: string;
  sendOtpBtn: string;
  sendingOtpBtn: string;
  otpLabel: string;
  verifyOtpBtn: string;
  changePhoneNumber: string;
  resendOtpBtn: string;
  errMissingPhone: string;
  errMissingOtp: string;
  otpSentInfoPrefix: string;
  // Nav
  navHome: string;
  navUpdates: string;
  navCommunities: string;
  navSearch: string;
  navChat: string;
  navNotifications: string;
  navProfile: string;
  newPost: string;
  createPost: string;
  signOut: string;
  // WhatsApp-style Chats, Private DMs, Groups, Channels
  filterAll: string;
  filterPrivate: string;
  filterGroups: string;
  filterChannels: string;
  newPrivateAction: string;
  newGroupAction: string;
  newChannelAction: string;
  searchUnifiedPlaceholder: string;
  askDeepThinkAction: string;
  privateChatLabel: string;
  newPrivateChat: string;
  startPrivateChatHint: string;
  createGroup: string;
  createGroupSub: string;
  groupNameLabel: string;
  groupDescLabel: string;
  selectMembersLabel: string;
  membersWord: string;
  emptyGroupsTitle: string;
  emptyGroupsDesc: string;
  manageMembersBtn: string;
  createChannel: string;
  createChannelSub: string;
  channelNameLabel: string;
  channelDescLabel: string;
  channelReadOnlyHint: string;
  broadcastPlaceholder: string;
  emptyChannelsDesc: string;
  channelsTitle: string;
  communityFeedTitle: string;
  toastGroupCreated: string;
  toastChannelCreated: string;
  // Feed & PostCard
  whatsOnMind: string;
  postAction: string;
  emptyFeedTitle: string;
  emptyFeedDesc: string;
  createFirstPost: string;
  share: string;
  deepThink: string;
  hideInsight: string;
  deepThinkInsightHeader: string;
  analyzingPost: string;
  commentsTitle: string;
  noComments: string;
  commentAsPrefix: string;
  send: string;
  // Create Post Modal
  newPostTitle: string;
  postingAs: string;
  postPlaceholder: string;
  showDraftHelper: string;
  hideDraftHelper: string;
  draftPromptPlaceholder: string;
  draftPostBtn: string;
  thinkingBtn: string;
  cancel: string;
  publish: string;
  // Search
  searchPeoplePlaceholder: string;
  noSearchResultsPrefix: string;
  noSearchResultsHint: string;
  followersWord: string;
  followBtn: string;
  followingBtn: string;
  // Chat & Deep Think
  conversationsTitle: string;
  tapToChat: string;
  deepThinkTitle: string;
  deepThinkTagline: string;
  deepThinkHeaderSub: string;
  deepThinkWelcome: string;
  emptyChatTitlePrefix: string;
  emptyChatHint: string;
  deepThinkTyping: string;
  askDeepThinkPlaceholder: string;
  writeMessagePlaceholder: string;
  fullChat: string;
  deepThinkPanelDesc: string;
  askHighThinkingBtn: string;
  thinkingShort: string;
  answerHeader: string;
  peopleOnAlAmana: string;
  // Notifications
  notificationsTitle: string;
  unreadUpdatesWord: string;
  allCaughtUp: string;
  markAllRead: string;
  noNotifications: string;
  notifNew: string;
  notifLiked: string;
  notifFollowed: string;
  notifCommented: string;
  // Profile & Settings
  postsStat: string;
  followersStat: string;
  followingStat: string;
  editProfile: string;
  editProfileSub: string;
  profilePhotoLabel: string;
  uploadPhotoBtn: string;
  removePhotoBtn: string;
  onlineLabel: string;
  msgSentLabel: string;
  msgReadLabel: string;
  settingsTitle: string;
  aboutApp: string;
  signOutSub: string;
  yourPosts: string;
  noUserPosts: string;
  displayNameLabel: string;
  bioLabel: string;
  save: string;
  saving: string;
  appearanceTitle: string;
  appearanceDesc: string;
  lightLabel: string;
  darkLabel: string;
  languageTitle: string;
  languageDesc: string;
  hausaName: string;
  englishName: string;
  aboutTitle: string;
  aboutBody: string;
  // Toasts
  toastPostPublished: string;
  toastCopiedPrefix: string;
  toastProfileSaved: string;
  toastLanguageChanged: string;
  connectingApp: string;
  // Voice Messages & Audio/Video Calls
  voiceMessageLabel: string;
  recordingVoice: string;
  cancelRecording: string;
  sendVoiceNote: string;
  voiceMicLabel: string;
  voiceTooLargeErr: string;
  micPermissionErr: string;
  camPermissionErr: string;
  audioCallBtn: string;
  videoCallBtn: string;
  incomingAudioCall: string;
  incomingVideoCall: string;
  callingStatus: string;
  connectingCallStatus: string;
  connectedCallStatus: string;
  callEndedStatus: string;
  callDeclinedStatus: string;
  answerCallBtn: string;
  declineCallBtn: string;
  endCallBtn: string;
  muteMicBtn: string;
  unmuteMicBtn: string;
  cameraOffBtn: string;
  cameraOnBtn: string;
  flipCameraBtn: string;
  // Sponsored Posts & VIP Channels
  sponsoredLabel: string;
  manageSponsoredBtn: string;
  sponsoredModalTitle: string;
  sponsoredModalSub: string;
  businessNameLabel: string;
  adHeadlineLabel: string;
  adBodyLabel: string;
  ctaLabelField: string;
  actionUrlLabel: string;
  publishAdBtn: string;
  adStatusActive: string;
  adStatusPaused: string;
  pauseAdBtn: string;
  resumeAdBtn: string;
  deleteAdBtn: string;
  noSponsoredAds: string;
  toastAdPublished: string;
  errInvalidUrl: string;
  vipBadge: string;
  vipChannelToggleLabel: string;
  vipChannelToggleHint: string;
  vipPriceLabelField: string;
  vipPaymentInfoField: string;
  vipPaymentInfoPlaceholder: string;
  vipLockedTitle: string;
  vipLockedDesc: string;
  vipHowToPayTitle: string;
  vipOpenPaymentLink: string;
  vipCopyPaymentInfo: string;
  vipCopiedToast: string;
  vipWaitingActivation: string;
  vipMessageCreatorBtn: string;
  manageVipBtn: string;
  vipMembersTitle: string;
  vipMembersSub: string;
  grantVipBtn: string;
  revokeVipBtn: string;
  vipActiveBadge: string;
  vipBroadcastHint: string;
  vipSettingsSaved: string;
  vipMemberLimitNote: string;
  vipDaysWord: string;
  vipAutoLockBanner: string;
  vipExpiredTitle: string;
  vipExpiredDesc: string;
  vipExpiredBadge: string;
  vipRenewBtn: string;
  vipSubmitReceiptTitle: string;
  vipAmountPaidLabel: string;
  vipReferenceLabel: string;
  vipNoteLabel: string;
  vipReceiptImageLabel: string;
  vipPickReceiptBtn: string;
  vipChangeReceiptBtn: string;
  vipSubmitReceiptBtn: string;
  vipVerifyingReceiptBtn: string;
  vipReceiptSentToast: string;
  vipReceiptsTab: string;
  vipMembersTab: string;
  vipPendingStatus: string;
  vipApprovedStatus: string;
  vipRejectedStatus: string;
  vipVerdictMatch: string;
  vipVerdictReview: string;
  vipVerdictMismatch: string;
  vipVerdictUnavailable: string;
  vipApproveAndGrantBtn: string;
  vipRejectReceiptBtn: string;
  vipNoReceiptsYet: string;
  vipSafetyTip: string;
  vipErrNeedAmountOrImage: string;
  vipBillingTypeLabel: string;
  vipBillingMonthlyLabel: string;
  vipBillingMonthlyHint: string;
  vipBillingOnceLabel: string;
  vipBillingOnceHint: string;
  vipOnceBadge: string;
  vipLifetimeBanner: string;
  vipLockedOnceDesc: string;
  vipApproveLifetimeBtn: string;
  vipApprovedLifetimeStatus: string;
  vipReceiptSentOnceToast: string;
  // Chat AI Features (Translate, Transcribe, Summarize)
  translateBtn: string;
  translatingLabel: string;
  translatedToPrefix: string;
  hideTranslationBtn: string;
  transcribeBtn: string;
  transcribingLabel: string;
  transcriptLabel: string;
  hideTranscriptBtn: string;
  summarizeChatBtn: string;
  summarizeShortBtn: string;
  summarizingLabel: string;
  chatSummaryTitle: string;
  summaryMessagesWord: string;
  summaryEmptyErr: string;
  // Room Invite Links (Groups & Channels)
  inviteLinkTitle: string;
  groupInviteReadyTitle: string;
  channelInviteReadyTitle: string;
  inviteLinkDesc: string;
  copyInviteLinkBtn: string;
  shareInviteLinkBtn: string;
  linkCopiedToast: string;
  openRoomBtn: string;
  joiningViaLinkToast: string;
  joinedGroupToast: string;
  joinedChannelToast: string;
  inviteNotFoundErr: string;
  groupFullErr: string;
  shorteningLinkLabel: string;
  // PWA Install
  installAppTitle: string;
  installAppSubtitle: string;
  installAppIosHint: string;
  installAppBtn: string;
  dismissInstallLabel: string;
  installIosModalTitle: string;
  installIosStep1Title: string;
  installIosStep1Desc: string;
  installIosStep2Title: string;
  installIosStep2Desc: string;
  installIosGotItBtn: string;
  installAppProfileSub: string;
  // Real-Time Notifications & Sound
  enableNotificationsTitle: string;
  enableNotificationsDesc: string;
  enableNotificationsBtn: string;
  dismissNotifLabel: string;
  notifRowLabel: string;
  notifRowOnSub: string;
  notifRowOffSub: string;
  notifRowBlockedSub: string;
  notifSoundLabel: string;
  notifSoundOnSub: string;
  notifSoundOffSub: string;
  notifEnabledToast: string;
  notifDisabledToast: string;
  notifBlockedToast: string;
  notifWelcomeBody: string;
  notifNewMessageFromPrefix: string;
  notifNewChannelPostPrefix: string;
}

const HAUSA: Translations = {
  appName: 'World Connection',
  createAccount: 'Ƙirƙiri Asusu',
  welcomeBack: 'Barka da Dawowa',
  authSignUpSubtitle: 'Shiga World Connection domin fara haɗuwa da al’umma',
  authSignInSubtitle: 'Shiga asusunka na World Connection',
  fullName: 'Cikakken Suna',
  email: 'Imel (Email)',
  password: 'Kalmar Sirri (Password)',
  confirmPassword: 'Tabbatar da Kalmar Sirri',
  registerBtn: 'YI RAJISTA',
  loginBtn: 'SHIGA',
  continueWithGoogle: 'Shiga da Google',
  orDivider: 'KO',
  alreadyHaveAccount: 'Kana da asusu? Shiga',
  dontHaveAccount: 'Ba ka da asusu? Yi Rajista',
  errMissingEmailPass: 'Ka cika Email da Password.',
  errMissingName: 'Ka rubuta sunanka.',
  errPasswordMismatch: 'Passwords ba su yi daidai ba.',
  verifyEmailTitle: 'Tabbatar da Imel ɗinka',
  verifyEmailBodyPrefix: 'Mun tura hanyar tabbatarwa zuwa',
  verifyEmailBodySuffix: 'Duba inbox ɗinka ka danna link ɗin kafin ka ci gaba.',
  verifyContinueBtn: 'Na Tabbatar — Ci Gaba',
  checking: 'Ana dubawa...',
  resendVerificationBtn: 'Sake Tura Saƙon Tabbatarwa',
  useAnotherAccount: 'Yi amfani da wani asusu',
  authMethodEmail: 'Imel (Email)',
  authMethodPhone: 'Nambar Waya',
  countryCodeLabel: 'Lambar Ƙasa',
  phoneNumberLabel: 'Nambar Waya',
  sendOtpBtn: 'TURA LAMBAR TABBATARWA',
  sendingOtpBtn: 'Ana tura saƙo...',
  otpLabel: 'Lambar Tabbatarwa (OTP)',
  verifyOtpBtn: 'TABBATAR KA SHIGA',
  changePhoneNumber: 'Sauya nambar waya',
  resendOtpBtn: 'Sake Tura Lambar',
  errMissingPhone: 'Ka shigar da nambar waya mai inganci.',
  errMissingOtp: 'Ka shigar da lambar tabbatarwa mai lambobi 6.',
  otpSentInfoPrefix: 'An tura lambar tabbatarwa ta SMS zuwa',
  navHome: 'Sabuntawa',
  navUpdates: 'Sabuntawa',
  navCommunities: 'Ƙungiyoyi',
  navSearch: 'Nema',
  navChat: 'Tattaunawa',
  navNotifications: 'Sanarwa',
  navProfile: 'Asusu',
  newPost: 'Sabon Post',
  createPost: 'Sabon Post',
  signOut: 'Fita',
  filterAll: 'Duka',
  filterPrivate: 'Sirri',
  filterGroups: 'Groups',
  filterChannels: 'Channels',
  newPrivateAction: '+ Sabon Sirri',
  newGroupAction: '+ Sabon Group',
  newChannelAction: '+ Sabon Channel',
  searchUnifiedPlaceholder: 'Nemi hira, group, channel, ko World Connection AI...',
  askDeepThinkAction: 'Tambayi World Connection',
  privateChatLabel: 'Maganar Sirri',
  newPrivateChat: 'Sabuwar Maganar Sirri',
  startPrivateChatHint: 'Zaɓi mutum ɗaya don maganar sirri tsakaninku ku biyu',
  createGroup: 'Ƙirƙiri Group',
  createGroupSub: 'Tattaunawa da abokai da yawa',
  groupNameLabel: 'Sunan Group',
  groupDescLabel: 'Bayani (Na zaɓi)',
  selectMembersLabel: 'Zaɓi Membobi',
  membersWord: 'membobi',
  emptyGroupsTitle: 'Babu Group tukuna',
  emptyGroupsDesc: 'Ƙirƙiri sabon group don tattaunawa da abokai da yawa a lokaci guda.',
  manageMembersBtn: 'Membobi',
  createChannel: 'Ƙirƙiri Channel',
  createChannelSub: 'Yaɗa sanarwa ga mabiyanka',
  channelNameLabel: 'Sunan Channel',
  channelDescLabel: 'Bayani kan Channel',
  channelReadOnlyHint: 'Mai wannan channel ne kaɗai ke iya tura saƙo a nan.',
  broadcastPlaceholder: 'Rubuta sanarwa zuwa channel...',
  emptyChannelsDesc: 'Ƙirƙiri channel don yaɗa sanarwa ga mabiyanka, ko ka bi channels na jama’a.',
  channelsTitle: 'Channels',
  communityFeedTitle: 'Sabbin Rubuce-rubuce',
  toastGroupCreated: 'An ƙirƙiri sabon group!',
  toastChannelCreated: 'An ƙirƙiri sabon channel!',
  whatsOnMind: 'Me kake son wallafawa?',
  postAction: 'Wallafa',
  emptyFeedTitle: 'Barka da zuwa World Connection!',
  emptyFeedDesc:
    'Babu wani post a cikin feed tukuna. Wallafa rubutunka na farko domin fara tattaunawa.',
  createFirstPost: 'Wallafa Post na Farko',
  share: 'Raba',
  deepThink: 'World Connection',
  hideInsight: 'Ɓoye Nazari',
  deepThinkInsightHeader: 'World Connection · Nazari',
  analyzingPost: 'Ana nazari kan wannan rubutu...',
  commentsTitle: 'Tsokaci',
  noComments: 'Babu comment tukuna. Ka zama na farko da zai yi tsokaci.',
  commentAsPrefix: 'Rubuta comment a matsayin',
  send: 'Tura',
  newPostTitle: 'Sabon Post',
  postingAs: 'Ana wallafawa a matsayin',
  postPlaceholder: 'Me kake son wallafawa?',
  showDraftHelper: 'Yi amfani da World Connection don tsara rubutu',
  hideDraftHelper: 'Ɓoye mataimakin World Connection',
  draftPromptPlaceholder: 'Fadi ra’ayinka (misali: Nasiha kan haɗin kai)...',
  draftPostBtn: 'Tsara Rubutu',
  thinkingBtn: 'Ana tunani...',
  cancel: 'Soke',
  publish: 'Wallafa',
  searchPeoplePlaceholder: 'Nemi mutane...',
  noSearchResultsPrefix: 'Ba a sami kowa mai suna',
  noSearchResultsHint: 'Gwada neman wani suna ko handle na aboki.',
  followersWord: 'mabiya',
  followBtn: 'Bi',
  followingBtn: 'Kana Bi',
  conversationsTitle: 'Tattaunawa',
  tapToChat: 'Taɓa domin chat',
  deepThinkTitle: 'World Connection',
  deepThinkTagline: 'Mataimakin AI · Tambayoyi',
  deepThinkHeaderSub: 'Mataimakin AI · Hausa da Turanci',
  deepThinkWelcome:
    'Barka da zuwa World Connection. Ka tambaye ni duk wata tambaya—daga fasaha, lissafi, al’ada, ko rubuta saƙo mai ma’ana—a Hausa ko Turanci.',
  emptyChatTitlePrefix: 'Fara tattaunawa da',
  emptyChatHint: 'Rubuta saƙo a ƙasa domin tura gaisuwa ko magana.',
  deepThinkTyping: 'World Connection yana tunani...',
  askDeepThinkPlaceholder: 'Tambayi World Connection (Hausa ko Turanci)...',
  writeMessagePlaceholder: 'Rubuta saƙo...',
  fullChat: 'Buɗe Chat',
  deepThinkPanelDesc:
    'Mataimakin World Connection don amsa tambayoyi da nazari a Hausa ko Turanci.',
  askHighThinkingBtn: 'Tambayi World Connection',
  thinkingShort: 'Ana tunani...',
  answerHeader: 'Amsa (World Connection)',
  peopleOnAlAmana: 'Mutane a World Connection',
  notificationsTitle: 'Sanarwa',
  unreadUpdatesWord: 'sabbin sanarwa',
  allCaughtUp: 'An karanta duka',
  markAllRead: 'Karanta duka',
  noNotifications: 'Babu sanarwa tukuna.',
  notifNew: 'Sabo',
  notifLiked: 'ya ji daɗin rubutunka',
  notifFollowed: 'ya fara bin ka',
  notifCommented: 'ya yi tsokaci a rubutunka',
  postsStat: 'Rubutu',
  followersStat: 'Mabiya',
  followingStat: 'Waɗanda kake bi',
  editProfile: 'Gyara Profile',
  editProfileSub: 'Gyara hoto, suna da bayani',
  profilePhotoLabel: 'Hoton Profile',
  uploadPhotoBtn: 'Saka Hoto',
  removePhotoBtn: 'Cire',
  onlineLabel: 'Yana kan layi',
  msgSentLabel: 'An tura',
  msgReadLabel: 'An karanta',
  settingsTitle: 'Saituna',
  aboutApp: 'Game da Manhaja',
  signOutSub: 'Fita daga asusu',
  yourPosts: 'Rubuce-rubucenka',
  noUserPosts: 'Ba ka wallafa wani post tukuna ba.',
  displayNameLabel: 'Suna',
  bioLabel: 'Bayani (Bio)',
  save: 'Ajiye',
  saving: 'Ana ajiyewa...',
  appearanceTitle: 'Siffar Allo',
  appearanceDesc: 'Zaɓi tsakanin haske (Light) ko duhu (Dark)',
  lightLabel: 'Haske',
  darkLabel: 'Duhu',
  languageTitle: 'Zaɓin Yare',
  languageDesc: 'Sauya yaren manhaja tsakanin Hausa da Turanci',
  hausaName: 'Hausa',
  englishName: 'Turanci',
  aboutTitle: 'Game da World Connection',
  aboutBody:
    'World Connection dandali ne na sada zumunta wanda ke amfani da Firebase don adana rubuce-rubuce, tattaunawa kai tsaye, da kuma mataimakin World Connection don amsa tambayoyi a Hausa da Turanci.',
  toastPostPublished: 'An wallafa sabon post!',
  toastCopiedPrefix: 'An kwafi rubutun',
  toastProfileSaved: 'An sabunta profile!',
  toastLanguageChanged: 'An sauya yare zuwa Hausa',
  connectingApp: 'Ana haɗa World Connection...',
  voiceMessageLabel: 'Saƙon Murya',
  recordingVoice: 'Ana rikodin murya...',
  cancelRecording: 'Soke',
  sendVoiceNote: 'Tura Saƙon Murya',
  voiceMicLabel: 'Rikodin murya',
  voiceTooLargeErr: 'Saƙon murya ya yi tsawo sosai (iya daƙiƙa 60).',
  micPermissionErr: 'Ba a sami izinin makirufo (Microphone) ba.',
  camPermissionErr: 'Ba a sami izinin kamara ko makirufo ba.',
  audioCallBtn: 'Kiran Murya',
  videoCallBtn: 'Kiran Bidiyo',
  incomingAudioCall: 'Kiran Murya Mai Zuwa',
  incomingVideoCall: 'Kiran Bidiyo Mai Zuwa',
  callingStatus: 'Ana kira...',
  connectingCallStatus: 'Ana haɗawa...',
  connectedCallStatus: 'An haɗu',
  callEndedStatus: 'An yanke kiran',
  callDeclinedStatus: 'An ƙi amsa kiran',
  answerCallBtn: 'Amsa',
  declineCallBtn: 'Ƙi',
  endCallBtn: 'Yanke',
  muteMicBtn: 'Rufe Murya',
  unmuteMicBtn: 'Buɗe Murya',
  cameraOffBtn: 'Rufe Kamara',
  cameraOnBtn: 'Buɗe Kamara',
  flipCameraBtn: 'Juya Kamara',
  sponsoredLabel: 'Talla · Sponsored',
  manageSponsoredBtn: 'Tallan ’Yan Kasuwa',
  sponsoredModalTitle: 'Gudanar da Tallan ’Yan Kasuwa',
  sponsoredModalSub:
    'Wallafa tallan kasuwanci ko shafin da zai bayyana a saman Sabuntawa',
  businessNameLabel: 'Sunan Kasuwa / Kamfani',
  adHeadlineLabel: 'Taken Talla',
  adBodyLabel: 'Cikakken Bayanin Talla',
  ctaLabelField: 'Sunan Maɓalli (misali: Tuntuɓi a WhatsApp)',
  actionUrlLabel: 'Link na Tuntuɓa (https://wa.me/... ko Shafi)',
  publishAdBtn: 'Wallafa Talla',
  adStatusActive: 'Yana Aiki',
  adStatusPaused: 'An Dakatar',
  pauseAdBtn: 'Dakatar',
  resumeAdBtn: 'Kunna',
  deleteAdBtn: 'Goge',
  noSponsoredAds: 'Babu talla tukuna. Ƙirƙiri tallanka na farko a sama.',
  toastAdPublished: 'An wallafa sabon talla!',
  errInvalidUrl: 'Link dole ya fara da https:// ko http://',
  vipBadge: 'VIP',
  vipChannelToggleLabel: 'VIP Channel (Na Kuɗi)',
  vipChannelToggleHint:
    'Membobin da ka buɗe wa hanya ne kaɗai za su karanta saƙonni',
  vipPriceLabelField: 'Farashi (misali: ₦2,000 / wata)',
  vipPaymentInfoField: 'Hanyar Biya (Paystack link ko Banki + WhatsApp)',
  vipPaymentInfoPlaceholder:
    'Misali: Biya ₦2,000 zuwa https://paystack.com/pay/... ko Asusu: 0123456789 (GTBank), sai ka tura shaida a WhatsApp',
  vipLockedTitle: 'VIP Channel — Membobin da suka biya kaɗai',
  vipLockedDesc:
    'Don ganin sanarwa da bayanai masu muhimmanci a wannan VIP channel, bi umarnin biyan kuɗi na ƙasa sannan mai channel ya buɗe maka.',
  vipHowToPayTitle: 'Yadda Ake Biya',
  vipOpenPaymentLink: 'Buɗe Hanyar Biya',
  vipCopyPaymentInfo: 'Kwafi Bayanan Biya',
  vipCopiedToast: 'An kwafi bayanan biya!',
  vipWaitingActivation:
    'Idan ka riga ka biya, tura wa mai channel shaidar biya domin ya buɗe maka.',
  vipMessageCreatorBtn: 'Tura Shaida ga Mai Channel',
  manageVipBtn: 'Membobin VIP',
  vipMembersTitle: 'Gudanar da VIP Channel',
  vipMembersSub: 'Buɗe wa waɗanda suka biya kuɗi ko gyara farashi',
  grantVipBtn: 'Buɗe VIP',
  revokeVipBtn: 'Cire VIP',
  vipActiveBadge: 'VIP A Buɗe',
  vipBroadcastHint:
    'VIP Channel · Saƙonni na buɗewa ga membobin VIP ne kaɗai.',
  vipSettingsSaved: 'An sabunta saitunan VIP!',
  vipMemberLimitNote:
    'Ana iya ƙara har zuwa membobin VIP 49 a kowane VIP channel.',
  vipDaysWord: 'kwanaki',
  vipAutoLockBanner: 'VIP na Wata 1 · Zai rufe da kansa bayan',
  vipExpiredTitle: 'Wa’adin VIP na wata 1 ya ƙare',
  vipExpiredDesc:
    'Wannan VIP channel ya rufe da kansa bayan kwanaki 30. Biya kuɗin sabuntawa sannan ka tura sabon rasit don sake buɗewa.',
  vipExpiredBadge: 'Ya ƙare',
  vipRenewBtn: 'Sabunta (+Wata 1)',
  vipSubmitReceiptTitle: 'Tura Rasit na Biya don Tantancewa',
  vipAmountPaidLabel: 'Adadin da aka biya',
  vipReferenceLabel: 'Lambar Shaida / Sunan Asusu',
  vipNoteLabel: 'Ƙarin Bayani (Na zaɓi)',
  vipReceiptImageLabel: 'Hoton Rasit (Screenshot)',
  vipPickReceiptBtn: 'Zaɓi Hoton Rasit',
  vipChangeReceiptBtn: 'Sauya Hoto',
  vipSubmitReceiptBtn: 'Tantance & Tura Rasit',
  vipVerifyingReceiptBtn: 'Ana tantance rasit...',
  vipReceiptSentToast:
    'An tura rasit! Mai channel zai duba alert ya buɗe maka wata 1.',
  vipReceiptsTab: 'Rasitai',
  vipMembersTab: 'Membobi & Farashi',
  vipPendingStatus: 'Yana Jiran Amincewa',
  vipApprovedStatus: 'An Amince · An Buɗe Wata 1',
  vipRejectedStatus: 'An Ƙi Rasit',
  vipVerdictMatch: 'Rasit Ya Dace',
  vipVerdictReview: 'A Duba Alert Sosai',
  vipVerdictMismatch: 'Rasit Bai Dace Ba',
  vipVerdictUnavailable: 'Ba a bincika ba',
  vipApproveAndGrantBtn: 'Amince & Buɗe (Wata 1)',
  vipRejectReceiptBtn: 'Ƙi Rasit',
  vipNoReceiptsYet: 'Babu rasit ɗin biya da aka tura tukuna.',
  vipSafetyTip:
    'App yana tantance hoton rasit da adadin kuɗi da kansa, amma ka tabbatar da alert a bankinka kafin ka danna Amince don kare kai daga rasit na bogi.',
  vipErrNeedAmountOrImage:
    'Rubuta adadin da aka biya ko ka saka hoton rasit.',
  vipBillingTypeLabel: 'Tsarin Biyan VIP',
  vipBillingMonthlyLabel: 'Na Wata-Wata (Kwanaki 30)',
  vipBillingMonthlyHint: 'Zai rufe da kansa bayan wata 1 har sai an sabunta',
  vipBillingOnceLabel: 'Biya Sau Ɗaya (Na Dindindin)',
  vipBillingOnceHint: 'Idan mutum ya biya sau ɗaya, zai ci gaba da kasancewa a buɗe har abada',
  vipOnceBadge: 'Na Dindindin',
  vipLifetimeBanner: 'VIP Na Dindindin · Biya Sau Ɗaya',
  vipLockedOnceDesc:
    'Wannan VIP channel na biya sau ɗaya ne (na dindindin). Biya kuɗin sannan ka tura rasit domin a buɗe maka har abada.',
  vipApproveLifetimeBtn: 'Amince & Buɗe (Na Dindindin)',
  vipApprovedLifetimeStatus: 'An Amince · VIP Na Dindindin',
  vipReceiptSentOnceToast:
    'An tura rasit! Mai channel zai duba alert ya buɗe maka VIP na dindindin.',
  translateBtn: 'Fassara',
  translatingLabel: 'Ana fassara...',
  translatedToPrefix: 'Fassara zuwa',
  hideTranslationBtn: 'Ɓoye',
  transcribeBtn: 'Rubuta Murya',
  transcribingLabel: 'Ana rubutawa...',
  transcriptLabel: 'Rubutun Murya',
  hideTranscriptBtn: 'Ɓoye',
  summarizeChatBtn: 'Taƙaita Hira',
  summarizeShortBtn: 'Taƙaita',
  summarizingLabel: 'Ana taƙaitawa...',
  chatSummaryTitle: 'Taƙaitaccen Hirar Kwanan Nan',
  summaryMessagesWord: 'saƙonni',
  summaryEmptyErr: 'Babu saƙonnin da za a taƙaita tukuna.',
  inviteLinkTitle: 'Link ɗin Gayyata',
  groupInviteReadyTitle: 'An Ƙirƙiri Group · Link ɗin Gayyata',
  channelInviteReadyTitle: 'An Ƙirƙiri Channel · Link ɗin Gayyata',
  inviteLinkDesc:
    'Tura wannan link ɗin ga abokai ko jama’a domin su shiga kai tsaye:',
  copyInviteLinkBtn: 'Kwafi Link',
  shareInviteLinkBtn: 'Tura Link',
  linkCopiedToast: 'An kwafi link ɗin!',
  openRoomBtn: 'Buɗe Yanzu',
  joiningViaLinkToast: 'Ana shiga ta link...',
  joinedGroupToast: 'An shigar da kai group ɗin!',
  joinedChannelToast: 'An buɗe channel ɗin!',
  inviteNotFoundErr: 'Ba a sami wannan group ko channel ba.',
  groupFullErr: 'Wannan group ya cika (iyaka mutane 50).',
  shorteningLinkLabel: 'Ana gajarta link...',
  installAppTitle: 'Sauke World Connection',
  installAppSubtitle: 'Saka a wayarka don buɗewa kamar manhajar waya kai tsaye',
  installAppIosHint: 'Danna Share → Add to Home Screen a Safari (iPhone/iPad)',
  installAppBtn: 'Sauke App',
  dismissInstallLabel: 'Rufe shawarar sauke app',
  installIosModalTitle: 'Saka a Allon Waya (iPhone)',
  installIosStep1Title: 'Danna maɓallin Share a Safari',
  installIosStep1Desc: 'Yana ƙasa ko saman allon Safari (alama mai kibiya zuwa sama).',
  installIosStep2Title: 'Zaɓi "Add to Home Screen"',
  installIosStep2Desc: 'Gungura ƙasa ka danna "Add to Home Screen", sai ka danna "Add".',
  installIosGotItBtn: 'Na Gane',
  installAppProfileSub: 'Saka a wayarka don buɗewa ba tare da browser ba',
  enableNotificationsTitle: 'Kunna Sanarwar Saƙonni',
  enableNotificationsDesc: 'Samu ƙara da sanarwa kai tsaye idan an turo maka sabon saƙo',
  enableNotificationsBtn: 'Kunna Sanarwa',
  dismissNotifLabel: 'Rufe shawarar kunna sanarwa',
  notifRowLabel: 'Sanarwar Wayar (Push Alerts)',
  notifRowOnSub: 'A kunne · Ana nuna sanarwar saƙonni',
  notifRowOffSub: 'A rufe · Danna don kunnawa',
  notifRowBlockedSub: 'An toshe a browser · Buɗe a Site Settings',
  notifSoundLabel: 'Sautin Sanarwa',
  notifSoundOnSub: 'Ƙara tana kunne ga sabbin saƙonni',
  notifSoundOffSub: 'Shiru (babu ƙara)',
  notifEnabledToast: 'An kunna sanarwar saƙonni!',
  notifDisabledToast: 'An kashe sanarwar wayar.',
  notifBlockedToast: 'Browser ta toshe izinin sanarwa — buɗe a Settings.',
  notifWelcomeBody: 'An kunna sanarwar World Connection! Za ka riƙa samun sanarwa da ƙara ga sabbin saƙonni.',
  notifNewMessageFromPrefix: 'Sabon saƙo daga',
  notifNewChannelPostPrefix: 'Sabon sako a channel:',
};

const ENGLISH: Translations = {
  appName: 'World Connection',
  createAccount: 'Create Your Account',
  welcomeBack: 'Welcome Back',
  authSignUpSubtitle: 'Join World Connection to connect with the community',
  authSignInSubtitle: 'Sign in to your World Connection account',
  fullName: 'Full Name',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  registerBtn: 'REGISTER',
  loginBtn: 'LOGIN',
  continueWithGoogle: 'Continue with Google',
  orDivider: 'OR',
  alreadyHaveAccount: 'Already have an account? Sign In',
  dontHaveAccount: 'Don’t have an account? Sign Up',
  errMissingEmailPass: 'Please enter your Email and Password.',
  errMissingName: 'Please enter your full name.',
  errPasswordMismatch: 'Passwords do not match.',
  verifyEmailTitle: 'Verify Your Email',
  verifyEmailBodyPrefix: 'We sent a verification link to',
  verifyEmailBodySuffix: 'Check your inbox and click the link before continuing.',
  verifyContinueBtn: 'I’ve Verified — Continue',
  checking: 'Checking...',
  resendVerificationBtn: 'Resend Verification Email',
  useAnotherAccount: 'Use another account',
  authMethodEmail: 'Email',
  authMethodPhone: 'Phone Number',
  countryCodeLabel: 'Country Code',
  phoneNumberLabel: 'Phone Number',
  sendOtpBtn: 'SEND VERIFICATION CODE',
  sendingOtpBtn: 'Sending code...',
  otpLabel: 'Verification Code (OTP)',
  verifyOtpBtn: 'VERIFY & SIGN IN',
  changePhoneNumber: 'Change phone number',
  resendOtpBtn: 'Resend Code',
  errMissingPhone: 'Please enter a valid phone number.',
  errMissingOtp: 'Please enter the 6-digit verification code.',
  otpSentInfoPrefix: 'An SMS verification code was sent to',
  navHome: 'Updates',
  navUpdates: 'Updates',
  navCommunities: 'Communities',
  navSearch: 'Search',
  navChat: 'Chats',
  navNotifications: 'Alerts',
  navProfile: 'Profile',
  newPost: 'New Post',
  createPost: 'Create Post',
  signOut: 'Sign Out',
  filterAll: 'All',
  filterPrivate: 'Private',
  filterGroups: 'Groups',
  filterChannels: 'Channels',
  newPrivateAction: '+ New Private',
  newGroupAction: '+ New Group',
  newChannelAction: '+ New Channel',
  searchUnifiedPlaceholder: 'Ask World Connection or search chats, groups, channels...',
  askDeepThinkAction: 'Ask World Connection',
  privateChatLabel: 'Private Chat',
  newPrivateChat: 'New Private Chat',
  startPrivateChatHint: 'Pick one member for a private 1-on-1 conversation',
  createGroup: 'Create Group',
  createGroupSub: 'Chat with multiple members together',
  groupNameLabel: 'Group Name',
  groupDescLabel: 'Description (Optional)',
  selectMembersLabel: 'Select Members',
  membersWord: 'members',
  emptyGroupsTitle: 'No Groups yet',
  emptyGroupsDesc: 'Create a group to chat with multiple members together.',
  manageMembersBtn: 'Members',
  createChannel: 'Create Channel',
  createChannelSub: 'Broadcast updates to followers',
  channelNameLabel: 'Channel Name',
  channelDescLabel: 'Channel Description',
  channelReadOnlyHint: 'Only the channel creator can publish updates here.',
  broadcastPlaceholder: 'Post an update to your channel...',
  emptyChannelsDesc: 'Create a channel to broadcast updates to followers, or follow public channels.',
  channelsTitle: 'Channels',
  communityFeedTitle: 'Community Posts',
  toastGroupCreated: 'Group created!',
  toastChannelCreated: 'Channel created!',
  whatsOnMind: 'What would you like to share?',
  postAction: 'Post',
  emptyFeedTitle: 'Welcome to World Connection!',
  emptyFeedDesc:
    'There are no posts in the feed yet. Publish your first post to start the conversation.',
  createFirstPost: 'Create First Post',
  share: 'Share',
  deepThink: 'World Connection',
  hideInsight: 'Hide Insight',
  deepThinkInsightHeader: 'World Connection · Insight',
  analyzingPost: 'Analyzing this post carefully...',
  commentsTitle: 'Comments',
  noComments: 'No comments yet. Be the first to reply.',
  commentAsPrefix: 'Write a comment as',
  send: 'Send',
  newPostTitle: 'New Post',
  postingAs: 'Posting as',
  postPlaceholder: 'What would you like to share?',
  showDraftHelper: 'Use World Connection to draft or refine',
  hideDraftHelper: 'Hide World Connection post assistant',
  draftPromptPlaceholder: 'Describe your idea (e.g. Community unity)...',
  draftPostBtn: 'Draft Post',
  thinkingBtn: 'Thinking...',
  cancel: 'Cancel',
  publish: 'Publish',
  searchPeoplePlaceholder: 'Search people...',
  noSearchResultsPrefix: 'No members found matching',
  noSearchResultsHint: 'Try searching by another name or handle.',
  followersWord: 'followers',
  followBtn: 'Follow',
  followingBtn: 'Following',
  conversationsTitle: 'Conversations',
  tapToChat: 'Tap to chat',
  deepThinkTitle: 'World Connection',
  deepThinkTagline: 'AI Assistant · Q&A',
  deepThinkHeaderSub: 'AI assistant · Hausa & English',
  deepThinkWelcome:
    'Welcome to World Connection. Ask me any question—from technology, math, and culture to thoughtful writing—in Hausa or English.',
  emptyChatTitlePrefix: 'Start a conversation with',
  emptyChatHint: 'Write a message below to say hello.',
  deepThinkTyping: 'World Connection is thinking...',
  askDeepThinkPlaceholder: 'Ask World Connection (Hausa or English)...',
  writeMessagePlaceholder: 'Write a message...',
  fullChat: 'Full Chat',
  deepThinkPanelDesc:
    'World Connection assistant for questions, Hausa/English insights, and step-by-step analysis.',
  askHighThinkingBtn: 'Ask World Connection',
  thinkingShort: 'Thinking...',
  answerHeader: 'Answer (World Connection)',
  peopleOnAlAmana: 'People on World Connection',
  notificationsTitle: 'Notifications',
  unreadUpdatesWord: 'unread updates',
  allCaughtUp: 'All caught up',
  markAllRead: 'Mark all read',
  noNotifications: 'No notifications yet.',
  notifNew: 'New',
  notifLiked: 'liked your post',
  notifFollowed: 'followed you',
  notifCommented: 'commented on your post',
  postsStat: 'Posts',
  followersStat: 'Followers',
  followingStat: 'Following',
  editProfile: 'Edit Profile',
  editProfileSub: 'Update your photo, name, and bio',
  profilePhotoLabel: 'Profile Photo',
  uploadPhotoBtn: 'Upload Photo',
  removePhotoBtn: 'Remove',
  onlineLabel: 'Online',
  msgSentLabel: 'Sent',
  msgReadLabel: 'Read',
  settingsTitle: 'Settings',
  aboutApp: 'About App',
  signOutSub: 'Sign out of your account',
  yourPosts: 'Your Posts',
  noUserPosts: 'You have not published any posts yet.',
  displayNameLabel: 'Display Name',
  bioLabel: 'Bio',
  save: 'Save',
  saving: 'Saving...',
  appearanceTitle: 'Appearance',
  appearanceDesc: 'Switch between Light and Dark theme',
  lightLabel: 'Light',
  darkLabel: 'Dark',
  languageTitle: 'Language',
  languageDesc: 'Choose Hausa or English for the interface',
  hausaName: 'Hausa',
  englishName: 'English',
  aboutTitle: 'About World Connection',
  aboutBody:
    'World Connection is a community social platform powered by Firebase Authentication and Cloud Firestore for real-time posts, direct chat, and World Connection assistant insights in Hausa and English.',
  toastPostPublished: 'Post published!',
  toastCopiedPrefix: 'Copied post from',
  toastProfileSaved: 'Profile updated!',
  toastLanguageChanged: 'Language switched to English',
  connectingApp: 'Connecting World Connection...',
  voiceMessageLabel: 'Voice message',
  recordingVoice: 'Recording voice...',
  cancelRecording: 'Cancel',
  sendVoiceNote: 'Send voice message',
  voiceMicLabel: 'Record voice message',
  voiceTooLargeErr: 'Voice message is too long (max 60s).',
  micPermissionErr: 'Microphone access was denied or unavailable.',
  camPermissionErr: 'Camera or microphone access was denied or unavailable.',
  audioCallBtn: 'Audio Call',
  videoCallBtn: 'Video Call',
  incomingAudioCall: 'Incoming Audio Call',
  incomingVideoCall: 'Incoming Video Call',
  callingStatus: 'Calling...',
  connectingCallStatus: 'Connecting...',
  connectedCallStatus: 'Connected',
  callEndedStatus: 'Call ended',
  callDeclinedStatus: 'Call declined',
  answerCallBtn: 'Answer',
  declineCallBtn: 'Decline',
  endCallBtn: 'End',
  muteMicBtn: 'Mute',
  unmuteMicBtn: 'Unmute',
  cameraOffBtn: 'Cam Off',
  cameraOnBtn: 'Cam On',
  flipCameraBtn: 'Flip',
  sponsoredLabel: 'Sponsored',
  manageSponsoredBtn: 'Sponsored Ads',
  sponsoredModalTitle: 'Manage Sponsored Posts',
  sponsoredModalSub:
    'Publish paid business promotions pinned at the top of Updates',
  businessNameLabel: 'Business Name',
  adHeadlineLabel: 'Headline',
  adBodyLabel: 'Promotion Details',
  ctaLabelField: 'Button Text (e.g. Chat on WhatsApp)',
  actionUrlLabel: 'Action Link (https://wa.me/... or Website)',
  publishAdBtn: 'Publish Ad',
  adStatusActive: 'Active',
  adStatusPaused: 'Paused',
  pauseAdBtn: 'Pause',
  resumeAdBtn: 'Resume',
  deleteAdBtn: 'Delete',
  noSponsoredAds: 'No sponsored posts yet. Create your first promotion above.',
  toastAdPublished: 'Sponsored post published!',
  errInvalidUrl: 'Link must start with https:// or http://',
  vipBadge: 'VIP',
  vipChannelToggleLabel: 'VIP Channel (Paid Access)',
  vipChannelToggleHint:
    'Only approved paying subscribers can read broadcasts',
  vipPriceLabelField: 'Price (e.g. ₦2,000 / month)',
  vipPaymentInfoField: 'Payment Info (Paystack link or Bank + WhatsApp)',
  vipPaymentInfoPlaceholder:
    'Example: Pay ₦2,000 via https://paystack.com/pay/... or Bank transfer + send receipt in chat',
  vipLockedTitle: 'VIP Channel — Paid Subscribers Only',
  vipLockedDesc:
    'To unlock broadcasts in this VIP channel, complete the payment below and message the creator to activate your VIP access.',
  vipHowToPayTitle: 'Payment Instructions',
  vipOpenPaymentLink: 'Open Payment Link',
  vipCopyPaymentInfo: 'Copy Payment Info',
  vipCopiedToast: 'Payment details copied!',
  vipWaitingActivation:
    'Already paid? Send your receipt to the channel creator to unlock access.',
  vipMessageCreatorBtn: 'Message Creator',
  manageVipBtn: 'VIP Members',
  vipMembersTitle: 'Manage VIP Channel',
  vipMembersSub: 'Approve paying members or update price & payment info',
  grantVipBtn: 'Grant VIP',
  revokeVipBtn: 'Revoke VIP',
  vipActiveBadge: 'VIP Unlocked',
  vipBroadcastHint:
    'VIP Channel · Broadcasts are visible only to approved VIP members.',
  vipSettingsSaved: 'VIP settings updated!',
  vipMemberLimitNote:
    'Up to 49 VIP subscribers supported per VIP channel.',
  vipDaysWord: 'days',
  vipAutoLockBanner: '1-Month VIP · Auto-locks in',
  vipExpiredTitle: '1-Month VIP Subscription Expired',
  vipExpiredDesc:
    'This VIP channel automatically locked after 30 days. Complete renewal payment and submit a new receipt to unlock access.',
  vipExpiredBadge: 'Expired',
  vipRenewBtn: 'Renew (+1 Month)',
  vipSubmitReceiptTitle: 'Submit Payment Receipt for Verification',
  vipAmountPaidLabel: 'Amount Paid',
  vipReferenceLabel: 'Transfer Reference / Sender Name',
  vipNoteLabel: 'Note (Optional)',
  vipReceiptImageLabel: 'Receipt Screenshot',
  vipPickReceiptBtn: 'Upload Receipt Image',
  vipChangeReceiptBtn: 'Change Image',
  vipSubmitReceiptBtn: 'Verify & Submit Receipt',
  vipVerifyingReceiptBtn: 'Screening receipt...',
  vipReceiptSentToast:
    'Receipt submitted! The creator will confirm bank alert and unlock 30 days.',
  vipReceiptsTab: 'Receipts',
  vipMembersTab: 'Members & Price',
  vipPendingStatus: 'Pending Review',
  vipApprovedStatus: 'Approved · 30 Days Active',
  vipRejectedStatus: 'Receipt Rejected',
  vipVerdictMatch: 'Verified Match',
  vipVerdictReview: 'Needs Manual Check',
  vipVerdictMismatch: 'Mismatch Detected',
  vipVerdictUnavailable: 'Not Screened',
  vipApproveAndGrantBtn: 'Approve & Unlock (30d)',
  vipRejectReceiptBtn: 'Reject',
  vipNoReceiptsYet: 'No payment receipts submitted yet.',
  vipSafetyTip:
    'Automated screening checks the receipt screenshot and amount, while your 1-tap approval after checking your bank alert protects against fake screenshots.',
  vipErrNeedAmountOrImage:
    'Please enter the amount paid or upload a receipt image.',
  vipBillingTypeLabel: 'VIP Billing Type',
  vipBillingMonthlyLabel: 'Monthly (30 Days)',
  vipBillingMonthlyHint: 'Auto-locks after 30 days until renewed',
  vipBillingOnceLabel: 'One-Time Payment (Lifetime)',
  vipBillingOnceHint: 'Pay once for permanent VIP access with no expiry',
  vipOnceBadge: 'Lifetime VIP',
  vipLifetimeBanner: 'Lifetime VIP · One-Time Payment',
  vipLockedOnceDesc:
    'This is a one-time payment VIP channel. Pay once and submit your receipt to unlock permanent lifetime access.',
  vipApproveLifetimeBtn: 'Approve & Unlock (Lifetime)',
  vipApprovedLifetimeStatus: 'Approved · Lifetime VIP',
  vipReceiptSentOnceToast:
    'Receipt submitted! The creator will confirm bank alert and unlock lifetime VIP.',
  translateBtn: 'Translate',
  translatingLabel: 'Translating...',
  translatedToPrefix: 'Translated to',
  hideTranslationBtn: 'Hide',
  transcribeBtn: 'Transcribe',
  transcribingLabel: 'Transcribing...',
  transcriptLabel: 'Voice Transcript',
  hideTranscriptBtn: 'Hide',
  summarizeChatBtn: 'Summarize Chat',
  summarizeShortBtn: 'Summarize',
  summarizingLabel: 'Summarizing...',
  chatSummaryTitle: 'Recent Chat Summary',
  summaryMessagesWord: 'messages',
  summaryEmptyErr: 'No messages to summarize yet.',
  inviteLinkTitle: 'Invite Link',
  groupInviteReadyTitle: 'Group Created · Invite Link',
  channelInviteReadyTitle: 'Channel Created · Invite Link',
  inviteLinkDesc:
    'Share this link with friends or followers so they can join directly:',
  copyInviteLinkBtn: 'Copy Link',
  shareInviteLinkBtn: 'Share Link',
  linkCopiedToast: 'Invite link copied!',
  openRoomBtn: 'Open Now',
  joiningViaLinkToast: 'Opening invite link...',
  joinedGroupToast: 'Joined group!',
  joinedChannelToast: 'Channel opened!',
  inviteNotFoundErr: 'That group or channel could not be found.',
  groupFullErr: 'This group has reached the 50-member limit.',
  shorteningLinkLabel: 'Shortening link...',
  installAppTitle: 'Install World Connection',
  installAppSubtitle: 'Add to your home screen for a fast, full-screen native experience',
  installAppIosHint: 'Tap Share → Add to Home Screen in Safari on iPhone/iPad',
  installAppBtn: 'Install App',
  dismissInstallLabel: 'Dismiss install prompt',
  installIosModalTitle: 'Add to iPhone Home Screen',
  installIosStep1Title: 'Tap the Share button in Safari',
  installIosStep1Desc: 'Look for the square-with-arrow Share icon at the bottom or top of Safari.',
  installIosStep2Title: 'Tap "Add to Home Screen"',
  installIosStep2Desc: 'Scroll down the menu, select "Add to Home Screen", then tap "Add".',
  installIosGotItBtn: 'Got It',
  installAppProfileSub: 'Launch full-screen without browser bars',
  enableNotificationsTitle: 'Enable Real-Time Alerts',
  enableNotificationsDesc: 'Get instant sound & notification alerts whenever new messages arrive',
  enableNotificationsBtn: 'Enable Notifications',
  dismissNotifLabel: 'Dismiss notification prompt',
  notifRowLabel: 'Device Notifications',
  notifRowOnSub: 'Enabled · Alerts active for new messages',
  notifRowOffSub: 'Off · Tap to enable message alerts',
  notifRowBlockedSub: 'Blocked in browser · Allow in Site Settings',
  notifSoundLabel: 'Notification Sound',
  notifSoundOnSub: 'Play chime when new messages arrive',
  notifSoundOffSub: 'Muted',
  notifEnabledToast: 'Notifications enabled!',
  notifDisabledToast: 'Device notifications turned off.',
  notifBlockedToast: 'Notifications are blocked by your browser — allow them in Site Settings.',
  notifWelcomeBody: 'World Connection alerts are active! You will receive alerts for new messages.',
  notifNewMessageFromPrefix: 'New message from',
  notifNewChannelPostPrefix: 'New update in',
};

export function getTranslations(lang: Language): Translations {
  return lang === 'ha' ? HAUSA : ENGLISH;
}
