import React from 'react';

interface RatingSelectorProps {
  rating: number;
  setRating: (rating: number) => void;
}

const RatingSelector = ({ rating, setRating }: RatingSelectorProps) => {
  return (
    <div className="rating-container">
      <style>{`
        .rating-wrapper {
          display: flex;
          flex-direction: row-reverse;
          gap: 0.3rem;
          transform-style: preserve-3d;
          perspective: 1000px;
          justify-content: flex-end;
        }
        .rating-wrapper input {
          display: none;
        }

        .rating-wrapper label .svgOne {
          stroke: #ccc;
          fill: rgba(255, 217, 0, 0);
          transition: stroke 0.5s ease, fill 0.5s ease;
        }

        .rating-wrapper label .svgTwo {
          position: absolute;
          top: -1px;
          left: 0;
          fill: gold;
          stroke: rgba(255, 217, 0, 0);
          opacity: 0;
          transition: stroke 0.5s ease, fill 0.5s ease, opacity 0.5s ease;
        }

        .rating-wrapper label {
          position: relative;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 3px;
          transition: all 0.5s ease;
        }

        /* Selected or hovered stars */
        .rating-wrapper label:hover .svgOne,
        .rating-wrapper label:hover ~ label .svgOne {
          stroke: gold;
        }

        .rating-wrapper input:checked ~ label .svgOne {
          stroke: #cccccc00;
        }

        .rating-wrapper input:checked ~ label .svgTwo {
          transform: rotateX(0deg) rotateY(0deg) translateY(0px);
          opacity: 1;
          animation: displayStar 0.5s cubic-bezier(0.75, 0.41, 0.82, 1.2);
        }

        @keyframes displayStar {
          0% {
            transform: rotateX(100deg) rotateY(100deg) translateY(10px);
          }
          100% {
            transform: rotateX(0deg) rotateY(0deg) translateY(0px);
          }
        }

        .ombre {
          background: radial-gradient(
            ellipse closest-side,
            rgba(0, 0, 0, 0.24),
            rgba(0, 0, 0, 0)
          );
          width: 30px;
          height: 8px;
          opacity: 0;
          transition: opacity 0.6s ease 0.2s;
        }

        .rating-wrapper label:hover .ombre,
        .rating-wrapper label:hover ~ label .ombre {
          opacity: 0.3;
        }

        .rating-wrapper input:checked ~ label .ombre {
          opacity: 1;
        }

        .rating-wrapper label:hover .svgTwo:hover {
          animation: chackStar 0.6s ease-out, displayStar none 1s;
        }

        @keyframes chackStar {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(-20deg); }
          50% { transform: rotate(20deg); }
          80% { transform: rotate(-20deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
      
      <div className="rating-wrapper">
        {[5, 4, 3, 2, 1].map((num) => (
          <React.Fragment key={num}>
            <input 
              value={num} 
              name="rating" 
              id={`star${num}`} 
              type="radio" 
              checked={rating === num}
              onChange={() => setRating(num)}
            />
            <label title={`${num} stars`} htmlFor={`star${num}`}>
              <svg strokeLinejoin="round" strokeLinecap="round" strokeWidth={2} stroke="#000000" fill="none" viewBox="0 0 24 24" height={35} width={35} xmlns="http://www.w3.org/2000/svg" className="svgOne">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <svg strokeLinejoin="round" strokeLinecap="round" strokeWidth={2} stroke="#000000" fill="none" viewBox="0 0 24 24" height={35} width={35} xmlns="http://www.w3.org/2000/svg" className="svgTwo">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <div className="ombre" />
            </label>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default RatingSelector;
