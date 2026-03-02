export interface MarketplaceConfig {
  collection: {
    name: string;
    slug: string;
    description: string;
    artist: string;
    totalSupply: number;
    parentInscriptionIds: string[];
    grandparentId: string;
    colors: string[];
  };
  marketplace: {
    name: string;
    feePercent: number;
    feeAddress: string;
    minListingPriceSats: number;
    network: "mainnet" | "testnet" | "signet";
    adminAddresses: string[];
  };
  theme: {
    variant: "amber" | "green" | "blue" | "custom";
    primaryColor: string;
    primaryDim: string;
    primaryBright: string;
    backgroundColor: string;
    errorColor: string;
    borderColor: string;
    scanlines: boolean;
    flicker: boolean;
    crtCurvature: boolean;
    fontFamily: string;
    soundEffects: boolean;
  };
  nostr: {
    relays: string[];
    eventKind: number;
  };
  indexer: {
    provider: "unisat" | "hiro" | "custom";
    apiKey: string;
    baseUrl: string;
  };
  wallets: {
    xverse: boolean;
    unisat: boolean;
  };
}

const config: MarketplaceConfig = {
  collection: {
    name: "Bitcoin Lava Lamps: Wall of Entropy",
    slug: "lava-lamps",
    description:
      "A digital recreation of the cultural icon that safeguards the modern internet. " +
      "Inspired by the physical walls of lava lamps used by companies like Cloudflare to generate " +
      "random number sequences for cryptographic security, this collection permanently anchors " +
      "that wall of entropy onto the Bitcoin blockchain.",
    artist: "Lingle",
    totalSupply: 1950,
    parentInscriptionIds: [
      "e23c5c7cecee8bb8d7e642635be005a1964c803b68a5569efc67ab9fa72c8403i0",
      "4d833beaeed398e0afa0b1ec6a77b0634ce9328a54bfaed1d4ac3c33670aec08i0",
      "6d7b29f5e9aefb8cbf93c313805aa3fd36db64c730952175de67f8d849607a09i0",
      "ed70ff829df93de44f495e5b18b562e6e442f6da61cc0e7469bb82396b11460ei0",
      "754619b3f79d064ad53684ab59c589ccf271ee11a22d6139655bbcb01e5d1510i0",
      "c20ee63ee55c3bb993933656e54326ea6bf2b05e2bf18ead31ac1872eddd0815i0",
      "0cbd603e2ec76614b8e3fe1e2f70a17fb50de9df34ffc5d4a208fbb5fc9b5a15i0",
      "b6937977cc844eefe7aec924e54ed82a85d8aecc0be5dd1b4c4aabc8d8bc0817i0",
      "8f2cc245f113a68eaaa0d2f085df0936a5822ffc4f159627e6046a864c0d5b1bi0",
      "f98c45aaac41a9e88c880ecd0794d519912f42927b6b3e429feb0f95c9685103i0",
      "cc0ca5dda91fa82e6b1e4065576964ab5ef0620964f27390421b9af539390429i0",
      "f2acbbfe7e735bd3ab94a43611cf7679e6f1df5f43d59b015c2af72519d3372ai0",
      "378a65492164df7f98b3f7b323dc2429deb0e2ff2737e6dd590a30a47be18b32i0",
      "5748bd8ce17547ea3c3e00e1a083f23c20f0b8c4aa09c0bffae2e7f63bad8a33i0",
      "b202d3994d1337a9eb829e6141091343fb028911c6cc154fa31d871f43b30b38i0",
      "811d16d4cbd5960c6d891e67013442c97ac24e35e96d13f5b0534a9f16a2c83bi0",
      "181b8ec0cd948d89396e0b5aaf8c1fbbed4fb222ed857294a53f56f8c4f2f33bi0",
      "454c3bd070fca8659f2dae0b128a4f8bcb3c27a1da2dd225296d6c118bc88e52i0",
      "56722689a60357cbc93513dad66319b403832484ce9fe3bbbbc6197ff36d8271i0",
      "70b6ef66083e3f4f4a4a7f3e3ea93bb29b66f49e7664958732c885aacd2ca383i0",
      "b50d81334208b316845c7b10ddd442c2ed11a49dc7b2802e445c1f08c9fc3b84i0",
      "0827dd8e8ab1bc07a280e17b98b0fe140e09885fee41f5cc0e155eef7e57ae85i0",
      "0dbab300b90521b6f74ec6132a40c41baed747974dbac3b32a685b48b8fc6589i0",
      "3fe1ca7c56d3f2a5f883eff3f7562a9db8bd40a1fc2e63110aa9b2dee049adbci0",
      "a928dd4dcca54bacc07d6788e8a73325d8497dcc542e67d48b1ce42d6665b7afi0",
      "8c797bf7edb8436c305b5ae6613bea30f3b9ea5a6d7cb25a394c9c3ce3944db6i0",
      "dd831d8eabbe4e272625a690613672d7734a228c83eb90520233822ca42a6ab1i0",
      "324cc819ed3466fac77b1b6dd7bcedc1e21189a5fcf0a073a7211e2a6f0174b1i0",
      "9bffb64a6c93f98a29c6fdea09cb7a8ce78f15d97e675ef5bbe08d9eccc6d9b3i0",
      "b20f40d27b7809f7bf7ac87948aa81defe7959dbcb89adb768ad8f70c57b0abci0",
      "67f59fd920bdafaa9d95236558e9b2f3ccd0545daa84f94f8f52857ed54c7bbci0",
      "ab70cede510fcbfd67a2bedc87c624d4379a44533b43f875d149e0561a720cd6i0",
      "cae0d6f8494da1b4dc8061b1495faa8dc8ce39865c461fdd90c2e9525afe72d8i0",
      "78ebc6dd3f7a936eb1519d7d715fe306919527c5be9ed70526506058717a36d8i0",
      "57b027e1e55cee8e717f875e6f9b3b9ac2346c3c236bc868a6e3f58bd1c47aeai0",
      "09b7b799dd439921c3b34962b62103633422399b5c1b59d2968d7d5f5bbb88eci0",
      "eeb21536ad584b722036ab649de5487a4330486c0de10ce517095f4ade6a78edi0",
      "c7d1378a8132785a823775253bb2abf2bdefeb68b9d70e3bf16c22e21dd927fbi0",
      "86e46c33827a22aac82891e7c5f16a6ead6c8d029ed9de64ffb4ce1da3368430i0",
      "d298a371a9e49e5934272e09d9ff2990b782ac2c83a2154d68904121f474c7fbi0",
      "d298a371a9e49e5934272e09d9ff2990b782ac2c83a2154d68904121f474c7fbi1",
      "d298a371a9e49e5934272e09d9ff2990b782ac2c83a2154d68904121f474c7fbi2",
      "d298a371a9e49e5934272e09d9ff2990b782ac2c83a2154d68904121f474c7fbi3",
      "b274657542d2741773d291d102099fde7cd69330a884d6b0e6197b6afe223b9bi0",
      "29fab7503de4600627722c0a6576aa6c5a5e0a5708a722d506f6db4172d9b926i0",
      "52cb064d983c64a9e164459ab2457df153097e4c3c7debad43d1494491df6890i0",
      "bf467cc235705befdcfb0c0d74888caf8c0255687fa97480f4f3c4301bd4ce2di0",
      "5e5104aaf6e554baf0a32ff5133d6160d13d4a34eeb0ba53cdb44274de8b6826i0",
      "ec3d6a704ffd0d5ddafd10558c9532c8deb9a875015fe5d42b6aa508de69d55ci0",
      "ab92cff8cde24dc7dc1cec938b01776999a3dc8d69c23e5a03825cd7564ca121i0",
      "d840380e96f34a8594a88f29326ee42ca8d4137456550decf638013e42c5627bi0",
      "65f46908e120401efb0be9de7cbaf8e7fe336f5d371ae0613efb32699ccee133i0",
      "adfde14cf0b623a40ff80cf6c480088b9cfead4fa7444288811b747754fb9820i0",
      "4aeae1fdef1c10c0fe22cb15e871fa1bdd443ed775c6ca304201c9981a06e47ai0",
      "480abc15e6fe1a6022051f8d946109e6d407aae62c9e96729c2341ede0f848f0i0",
      "5c8054833b07537ef3c602aa6e0cf9e4fe2132d5bd082411388a4af290d93c35i0",
      "5ad949a0843d6c05a674a4edaa6894794481a9ab9632b55867b4bc840ce706fbi0",
      "eb6cfaf02d09221cc30d43a8e1e4ffad95b2fc59ca4e0b17831ef3821171fc5ci0",
      "723a3714c8d395464a9e65632ce8811a0574b10ed0b33dcf1dc7f27fd6c04008i0",
      "1b4c6ebe7228cf06282e4034b391163e9cd6022bc799ba077ad485a470c6e6a0i0",
      "b4a8352a57de60e0f914dd0f5a273408be735b8779d1eaf3d769512d74bd845bi0",
      "1febfcf436cc5f6728362c2241368d71f80cf0dde905f71e1f536ddf33849b4ai0",
      "28f79b2e8cff262ef7ea80a2a4e0504577b12aab4723f553928c06cb8e530734i0",
    ],
    grandparentId: "cb0a6ce408702c2b0386f8187a4f829d943e77b1e7aa8d11e97bc85075b684b9i0", // inscription #152930 "world peace"
    colors: [
      "Crimson",
      "Azure",
      "Gold",
      "Jade",
      "Violet",
      "Coral",
      "Teal",
      "Amber",
      "Rose",
      "Cobalt",
      "Lime",
      "Magenta",
      "Ivory",
      "Onyx",
      "Sapphire",
      "Ruby",
      "Emerald",
      "Topaz",
      "Pearl",
      "Obsidian",
      "Turquoise",
      "Copper",
      "??? Mystery", // 23rd color — dynamic based on block height
    ],
  },

  marketplace: {
    name: "LAVA TERMINAL",
    feePercent: 2,
    feeAddress: "bc1pp8jjn7mhyqzp2qs3jahl848kw2v9lhupu7fdavs9wc3tx4tkja6qd3pfyx",
    minListingPriceSats: 10000,
    network: "mainnet",
    adminAddresses: [
      "bc1pp8jjn7mhyqzp2qs3jahl848kw2v9lhupu7fdavs9wc3tx4tkja6qd3pfyx",
    ],
  },

  theme: {
    variant: "amber",
    primaryColor: "#FFB000",
    primaryDim: "#996600",
    primaryBright: "#FFCC00",
    backgroundColor: "#0A0A00",
    errorColor: "#FF4400",
    borderColor: "#664400",
    scanlines: true,
    flicker: true,
    crtCurvature: true,
    fontFamily: "'IBM Plex Mono', 'VT323', 'Courier New', monospace",
    soundEffects: false,
  },

  nostr: {
    relays: [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://relay.snort.social",
    ],
    eventKind: 30078, // NIP-78 arbitrary custom app data
  },

  indexer: {
    provider: "unisat",
    apiKey: process.env.NEXT_PUBLIC_UNISAT_API_KEY || "",
    baseUrl: "https://open-api.unisat.io",
  },

  wallets: {
    xverse: true,
    unisat: true,
  },
};

export default config;
