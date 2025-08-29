const User = require('../models/User');
const Community = require('../models/Community');

// Get all experts (users with role 'expert') with their communities
exports.getExperts = async (req, res) => {
  try {
    console.log('=== Fetching experts ===');
    
    // Find all experts
    const experts = await User.find({ 
      role: 'expert', 
      isActive: true 
    }).select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');
    
    console.log(`Found ${experts.length} experts:`, experts.map(e => ({ id: e._id, name: `${e.firstName} ${e.lastName}` })));
    
    // Check all communities first
    const allCommunities = await Community.find({}).select('name creator isActive');
    console.log('All communities in database:', allCommunities.map(c => ({ 
      name: c.name, 
      creator: c.creator, 
      isActive: c.isActive 
    })));
    
    // For each expert, find communities they created
    const expertsWithCommunities = await Promise.all(
      experts.map(async (expert) => {
        try {
          console.log(`\n--- Processing expert: ${expert.firstName} ${expert.lastName} (ID: ${expert._id}) ---`);
          
          // Try both with and without isActive filter
          const communitiesActive = await Community.find({ 
            creator: expert._id,
            isActive: true 
          }).select('name displayTitle description category tags');
          
          const communitiesAll = await Community.find({ 
            creator: expert._id
          }).select('name displayTitle description category tags isActive');
          
          console.log(`Expert ${expert.firstName} - Active communities: ${communitiesActive.length}`);
          console.log(`Expert ${expert.firstName} - All communities: ${communitiesAll.length}`);
          
          if (communitiesAll.length > 0) {
            console.log('All communities for this expert:', communitiesAll.map(c => ({ 
              name: c.name, 
              isActive: c.isActive 
            })));
          }
          
          const expertData = expert.toObject();
          expertData.communities = communitiesActive; // Use active communities
          
          return expertData;
        } catch (error) {
          console.error(`Error fetching communities for expert ${expert._id}:`, error);
          // Return expert without communities if there's an error
          const expertData = expert.toObject();
          expertData.communities = [];
          return expertData;
        }
      })
    );
    
    console.log('=== Final result ===');
    expertsWithCommunities.forEach(expert => {
      console.log(`${expert.firstName} ${expert.lastName}: ${expert.communities.length} communities`);
    });
    
    res.json(expertsWithCommunities);
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};