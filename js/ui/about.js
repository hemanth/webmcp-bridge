    // About modal
    function openAbout() {
      document.getElementById('aboutModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeAbout() {
      document.getElementById('aboutModal').classList.remove('active');
      document.body.style.overflow = '';
    }

    // Close about modal when clicking outside
    document.getElementById('aboutModal').addEventListener('click', (e) => {
      if (e.target.id === 'aboutModal') {
        closeAbout();
      }
    });
