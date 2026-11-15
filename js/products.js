var products = {
  podi: {
    id: "podi",
    name: "Podi Varieties",
    nameTa: "பொடி வகைகள்",
    banner: "",
    bannerTa: "",
    displayOrder: 1,
    products: [
      { id: 1, name: "Idli Podi", nameTa: "இட்லி பொடி", desc: "", descTa: "", image: "idli-podi.jpg", weight: "100g", price: "₹45", avail: true },
      { id: 2, name: "Sambar Powder", nameTa: "சாம்பார் பொடி", desc: "", descTa: "", image: "sambar.jpg", weight: "100g", price: "₹60", avail: true },
      { id: 3, name: "Rasam Powder", nameTa: "ரசம் பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹75", avail: true },
      { id: 4, name: "Satham Podi", nameTa: "சாதம் பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹60", avail: true },
      { id: 5, name: "Murungai Podi", nameTa: "முருங்கை பொடி", desc: "", descTa: "", image: "drumstick-leaf-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 6, name: "Kariveppilai Podi", nameTa: "கறிவேப்பிலை பொடி", desc: "", descTa: "", image: "curry-leaf-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 7, name: "Pirandai Podi", nameTa: "பிரண்டை பொடி", desc: "", descTa: "", image: "pirandai-thokku.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 8, name: "Kollu Podi", nameTa: "கொள்ளு பொடி", desc: "", descTa: "", image: "idli-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 9, name: "Kollu Rasam Podi", nameTa: "கொள்ளு ரசம் பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹75", avail: true },
      { id: 10, name: "Poondu Podi", nameTa: "பூண்டு பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹75", avail: true },
      { id: 11, name: "Sundakkai Podi", nameTa: "சுண்டைக்காய் பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹75", avail: true },
      { id: 12, name: "Mudakathan Podi", nameTa: "முடக்கத்தான் பொடி", desc: "", descTa: "", image: "curry-leaf-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 13, name: "Garam Masala", nameTa: "கரம் மசாலா", desc: "", descTa: "", image: "curry-masala.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 14, name: "Kulambu Milagai Thool", nameTa: "குழம்பு மிலகாய் தூள்", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹60", avail: true },
      { id: 15, name: "Thalippu Vadagam", nameTa: "தாளிப்பு வடகம்", desc: "", descTa: "", image: "thalippu-vadagam.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 16, name: "65 Masala", nameTa: "65 மசாலா", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹25", avail: true },
      { id: 17, name: "Vallarai Podi", nameTa: "வல்லாரை பொடி", desc: "", descTa: "", image: "drumstick-leaf-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 18, name: "Thoothuvalai Podi", nameTa: "தூதுவளை பொடி", desc: "", descTa: "", image: "curry-leaf-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 19, name: "Aavaram Poo Podi", nameTa: "ஆவாரம் பூ பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹75", avail: true },
      { id: 20, name: "Veppam Poo Podi", nameTa: "வேப்பம் பூ பொடி", desc: "", descTa: "", image: "drumstick-leaf-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 21, name: "Karuppu Ulundhu Podi", nameTa: "கருப்பு உளுந்து பொடி", desc: "", descTa: "", image: "idli-podi.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 22, name: "Puli Sadam Podi", nameTa: "புளி சாதம் பொடி", desc: "", descTa: "", image: "curry-masala.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 23, name: "Lemon Sadam Podi", nameTa: "லெமன் சாதம் பொடி", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹75", avail: true }
    ]
  },
  soup: {
    id: "soup",
    name: "Soup Varieties",
    nameTa: "சூப் வகைகள்",
    banner: "",
    bannerTa: "",
    displayOrder: 2,
    products: [
      { id: 24, name: "Murungai Keerai Soup", nameTa: "முருங்கை கீரை சூப்", desc: "", descTa: "", image: "drumstick-soup.jpg", weight: "100g", price: "₹120", avail: true },
      { id: 25, name: "Mudavattukal Soup", nameTa: "முடவாட்டுகால் சூப்", desc: "", descTa: "", image: "drumstick-soup.jpg", weight: "50g", price: "₹120", avail: true }
    ]
  },
  kanji: {
    id: "kanji",
    name: "Kanji Mix",
    nameTa: "கஞ்சி மிக்ஸ்",
    banner: "",
    bannerTa: "",
    displayOrder: 3,
    products: [
      { id: 26, name: "Karuppu Kavuni Kanji", nameTa: "கருப்புகவுனி கஞ்சி", desc: "", descTa: "", image: "karuppu-kavuni-kanji.jpg", weight: "250g", price: "₹100", avail: true },
      { id: 27, name: "Mappillai Samba Kanji", nameTa: "மாப்பிள்ளை சம்பா", desc: "", descTa: "", image: "karuppu-kavuni-kanji.jpg", weight: "250g", price: "₹90", avail: true },
      { id: 28, name: "Kollu Kanji", nameTa: "கொள்ளு கஞ்சி", desc: "", descTa: "", image: "karuppu-kavuni-kanji.jpg", weight: "250g", price: "₹100", avail: true },
      { id: 29, name: "Karuppu Ulundhu Kanji", nameTa: "கருப்பு உளுந்து கஞ்சி", desc: "", descTa: "", image: "karuppu-kavuni-kanji.jpg", weight: "100g", price: "₹75", avail: true }
    ]
  },
  pickles: {
    id: "pickles",
    name: "Pickle Varieties",
    nameTa: "ஊறுகாய் வகைகள்",
    banner: "",
    bannerTa: "",
    displayOrder: 4,
    products: [
      { id: 30, legacySlug: "tomato-pickle", name: "Tomato Pickle (100g)", nameTa: "தக்காளி ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹60", avail: true },
      { id: 31, legacySlug: "garlic-pickle", name: "Garlic Pickle (100g)", nameTa: "பூண்டு ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹70", avail: true },
      { id: 32, legacySlug: "sundakkai-pickle", name: "Sundakkai Pickle (100g)", nameTa: "சுண்டைக்காய் ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹70", avail: true },
      { id: 33, legacySlug: "maa-inji-pickle", name: "Maa Inji Pickle (100g)", nameTa: "மா இஞ்சி ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹70", avail: true },
      { id: 34, legacySlug: "pirandai-thokku", name: "Pirandai Thokku (100g)", nameTa: "பிரண்டை தொக்கு (100கி)", desc: "", descTa: "", image: "pirandai-thokku.jpg", weight: "100g", price: "₹75", avail: true },
      { id: 35, legacySlug: "kariveppilai-thokku", name: "Kariveppilai Thokku (100g)", nameTa: "கறிவேப்பிலை தொக்கு (100கி)", desc: "", descTa: "", image: "pirandai-thokku.jpg", weight: "100g", price: "₹60", avail: true },
      { id: 36, legacySlug: "chinna-vengaya-thokku", name: "Chinna Vengaya Thokku (100g)", nameTa: "சின்ன வெங்காய தொக்கு (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹70", avail: true },
      { id: 37, legacySlug: "mango-pickle", name: "Mango Pickle (100g)", nameTa: "மாங்காய் ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹60", avail: true },
      { id: 38, legacySlug: "lemon-pickle", name: "Lemon Pickle (100g)", nameTa: "எலுமிச்சை ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹60", avail: true },
      { id: 39, legacySlug: "narthangai-pickle", name: "Narthangai Pickle (100g)", nameTa: "நார்த்தங்காய் ஊறுகாய் (100கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "100g", price: "₹70", avail: true },
      { id: 45, name: "Tomato Pickle (200g)", nameTa: "தக்காளி ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹120", avail: true },
      { id: 46, name: "Garlic Pickle (200g)", nameTa: "பூண்டு ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹140", avail: true },
      { id: 47, name: "Sundakkai Pickle (200g)", nameTa: "சுண்டைக்காய் ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹140", avail: true },
      { id: 48, name: "Maa Inji Pickle (200g)", nameTa: "மா இஞ்சி ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹140", avail: true },
      { id: 49, name: "Pirandai Thokku (200g)", nameTa: "பிரண்டை தொக்கு (200கி)", desc: "", descTa: "", image: "pirandai-thokku.jpg", weight: "200g", price: "₹150", avail: true },
      { id: 50, name: "Kariveppilai Thokku (200g)", nameTa: "கறிவேப்பிலை தொக்கு (200கி)", desc: "", descTa: "", image: "pirandai-thokku.jpg", weight: "200g", price: "₹120", avail: true },
      { id: 51, name: "Chinna Vengaya Thokku (200g)", nameTa: "சின்ன வெங்காய தொக்கு (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹140", avail: true },
      { id: 52, name: "Mango Pickle (200g)", nameTa: "மாங்காய் ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹120", avail: true },
      { id: 53, name: "Lemon Pickle (200g)", nameTa: "எலுமிச்சை ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹120", avail: true },
      { id: 54, name: "Narthangai Pickle (200g)", nameTa: "நார்த்தங்காய் ஊறுகாய் (200கி)", desc: "", descTa: "", image: "placeholder-product.png", weight: "200g", price: "₹140", avail: true }
    ]
  },
  kulambu: {
    id: "kulambu",
    name: "Kulambu Varieties",
    nameTa: "குழம்பு வகைகள்",
    banner: "",
    bannerTa: "",
    displayOrder: 5,
    products: [
      { id: 40, name: "Poondu Milagu Kulambu", nameTa: "பூண்டு மிளகு குழம்பு", desc: "", descTa: "", image: "vatha-kulambu.jpg", weight: "200g", price: "₹150", avail: true },
      { id: 41, name: "Vatha Kulambu", nameTa: "வத்தக்குழம்பு", desc: "", descTa: "", image: "vatha-kulambu.jpg", weight: "200g", price: "₹150", avail: true }
    ]
  },
  malt: {
    id: "malt",
    name: "Malt Varieties",
    nameTa: "மால்ட் வகைகள்",
    banner: "",
    bannerTa: "",
    displayOrder: 6,
    products: [
      { id: 42, name: "ABC Malt", nameTa: "ABC மால்ட்", desc: "", descTa: "", image: "abc-malt.jpg", weight: "100g", price: "₹120", avail: true },
      { id: 43, name: "Beetroot Malt", nameTa: "பீட்ரூட் மால்ட்", desc: "", descTa: "", image: "abc-malt.jpg", weight: "100g", price: "₹120", avail: true },
      { id: 44, name: "Ragi Choco Malt", nameTa: "ராகி சாக்கோ மால்ட்", desc: "", descTa: "", image: "abc-malt.jpg", weight: "100g", price: "₹120", avail: true }
    ]
  }
};

var allProducts = [];
Object.keys(products).forEach(function(key) {
  var cat = products[key];
  cat.products.forEach(function(prod) {
    allProducts.push({
      id: prod.id,
      name: prod.name,
      nameTa: prod.nameTa,
      category: cat.name,
      categoryTa: cat.nameTa,
      desc: prod.desc,
      descTa: prod.descTa,
      image: prod.image,
      weight: prod.weight,
      price: prod.price,
      avail: prod.avail,
      url: "category.html?type=" + key
    });
  });
});
