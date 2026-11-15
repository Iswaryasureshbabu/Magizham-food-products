// ==========================================
// HERO IMAGE SLIDER
// ==========================================

const slides = document.querySelectorAll(".slide");

let currentSlide = 0;
let slideInterval;

// ==========================================
// SHOW SLIDE
// ==========================================

function showSlide(index) {

    slides.forEach((slide) => {
        slide.classList.remove("active");
    });

    slides[index].classList.add("active");
}

// ==========================================
// NEXT SLIDE
// ==========================================

function nextSlide() {

    currentSlide++;

    if (currentSlide >= slides.length) {
        currentSlide = 0;
    }

    showSlide(currentSlide);
}

// ==========================================
// PREVIOUS SLIDE
// ==========================================

function previousSlide() {

    currentSlide--;

    if (currentSlide < 0) {
        currentSlide = slides.length - 1;
    }

    showSlide(currentSlide);
}

// ==========================================
// AUTO SLIDER (10 Seconds)
// ==========================================

function startSlider() {

    slideInterval = setInterval(() => {

        nextSlide();

    }, 10000);

}

// ==========================================
// STOP AUTO SLIDER
// ==========================================

function stopSlider() {

    clearInterval(slideInterval);

}

// ==========================================
// START
// ==========================================

showSlide(currentSlide);
startSlider();


// ==========================================
// PAUSE ON MOUSE HOVER
// ==========================================

const slider = document.querySelector(".slider");

slider.addEventListener("mouseenter", () => {

    stopSlider();

});

slider.addEventListener("mouseleave", () => {

    startSlider();

});


// ==========================================
// KEYBOARD SUPPORT
// ==========================================

document.addEventListener("keydown", (e) => {

    if (e.key === "ArrowRight") {

        stopSlider();
        nextSlide();
        startSlider();

    }

    if (e.key === "ArrowLeft") {

        stopSlider();
        previousSlide();
        startSlider();

    }

});


// ==========================================
// MOBILE SWIPE SUPPORT
// ==========================================

let touchStartX = 0;
let touchEndX = 0;

slider.addEventListener("touchstart", (e) => {

    touchStartX = e.changedTouches[0].screenX;

});

slider.addEventListener("touchend", (e) => {

    touchEndX = e.changedTouches[0].screenX;

    handleSwipe();

});

function handleSwipe() {

    if (touchEndX < touchStartX - 50) {

        stopSlider();
        nextSlide();
        startSlider();

    }

    if (touchEndX > touchStartX + 50) {

        stopSlider();
        previousSlide();
        startSlider();

    }

}


// ==========================================
// OPTIONAL NEXT & PREVIOUS BUTTONS
// ==========================================

// Add these buttons to HTML if needed:
//
// <button class="prev-slide">
//     <i class="fas fa-chevron-left"></i>
// </button>
//
// <button class="next-slide">
//     <i class="fas fa-chevron-right"></i>
// </button>

const nextButton = document.querySelector(".next-slide");
const prevButton = document.querySelector(".prev-slide");

if (nextButton) {

    nextButton.addEventListener("click", () => {

        stopSlider();
        nextSlide();
        startSlider();

    });

}

if (prevButton) {

    prevButton.addEventListener("click", () => {

        stopSlider();
        previousSlide();
        startSlider();

    });

}


// ==========================================
// PAGE VISIBILITY API
// Pause when browser tab is inactive
// ==========================================

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopSlider();

    } else {

        startSlider();

    }

});


// ==========================================
// END
// ==========================================